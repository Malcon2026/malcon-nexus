#!/usr/bin/env node
/**
 * Sync production doctors to canonical master list with MLS-DOC-001 … codes.
 *
 *   node scripts/sync-doctors-master.mjs --dry-run
 *   node scripts/sync-doctors-master.mjs --execute
 *
 * Optional: run supabase/migrations/add-doctor-code.sql in SQL Editor first so
 * doctor_code is stored on each row (otherwise codes live in app_settings only).
 *
 * Requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env / .env.local
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const dryRun = !process.argv.includes('--execute');
const namesPath = resolve(root, 'share/doctors-canonical-names.txt');

/** Snapshot spellings → canonical master name */
const SNAPSHOT_ALIASES = {
  'p somu': 'P. Somu',
  akilha: 'Akhila',
  vanshi: 'Vamshi',
  'bala raja shaker': 'Bala Rajashekar',
  'bala raja sheker': 'Bala Rajashekar',
  'bala vardhan': 'Bala Vardhan Reddy',
  chandrashekhar: 'Chandra Shekar',
  'dr sharath': 'Sharath',
  'dr.sharath': 'Sharath',
  kishor: 'Kishore',
  madhu: 'Madhu Sudhan',
  'hari prakash': 'Hari Prasad',
  arun: 'Arun Reddy',
  adharsh: 'Adarsh Kota',
};

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = resolve(root, name);
    if (!existsSync(envPath)) continue;
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i > 0 && !process.env[t.slice(0, i).trim()]) {
        process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
      }
    }
  }
}

function norm(s) {
  return (s ?? '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function codeForIndex(i) {
  return `MLS-DOC-${String(i + 1).padStart(3, '0')}`;
}

const MLS_CODE = /^MLS-DOC-\d{3}$/i;

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const canonicalNames = readFileSync(namesPath, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean);

if (canonicalNames.length === 0) {
  console.error('Empty canonical list:', namesPath);
  process.exit(1);
}

const { data: doctors, error: de } = await sb.from('doctors').select('id, name, specialization, hospital_id, phone');
if (de) {
  console.error(de.message);
  process.exit(1);
}

let hasDoctorCodeColumn = true;
{
  const { error } = await sb.from('doctors').select('doctor_code').limit(1);
  if (error?.message?.includes('doctor_code')) hasDoctorCodeColumn = false;
}

const { data: cases, error: ce } = await sb.from('cases').select('id, case_number, doctor_id, doctor_snapshot');
if (ce) {
  console.error(ce.message);
  process.exit(1);
}

const allDoctors = doctors ?? [];
const unusedIds = new Set(allDoctors.map((d) => d.id));
const master = [];

for (let i = 0; i < canonicalNames.length; i++) {
  const name = canonicalNames[i];
  const code = codeForIndex(i);
  const n = norm(name);
  const matches = allDoctors.filter((d) => unusedIds.has(d.id) && norm(d.name) === n);
  let id;
  let created = false;
  if (matches.length >= 1) {
    id = matches[0].id;
  } else {
    id = randomUUID();
    created = true;
  }
  unusedIds.delete(id);
  master.push({ code, name, id, created });
}

const masterByNorm = new Map(master.map((m) => [norm(m.name), m]));
const masterById = new Map(master.map((m) => [m.id, m]));

function resolveMasterForSnapshotName(rawName) {
  const trimmed = (rawName ?? '').trim();
  if (!trimmed) return null;
  const n = norm(trimmed);
  if (masterByNorm.has(n)) return masterByNorm.get(n);
  const alias = SNAPSHOT_ALIASES[n];
  if (alias && masterByNorm.has(norm(alias))) return masterByNorm.get(norm(alias));
  return null;
}

const caseUpdates = [];
for (const c of cases ?? []) {
  const snapName =
    typeof c.doctor_snapshot === 'object' && c.doctor_snapshot?.name
      ? String(c.doctor_snapshot.name)
      : '';
  const oldDoc = allDoctors.find((d) => d.id === c.doctor_id);
  let target = c.doctor_id && masterById.has(c.doctor_id) ? masterById.get(c.doctor_id) : null;
  if (!target && snapName) target = resolveMasterForSnapshotName(snapName);
  if (!target && oldDoc && !masterById.has(oldDoc.id)) {
    target = resolveMasterForSnapshotName(oldDoc.name);
  }
  if (!target) continue;
  const needsId = c.doctor_id !== target.id;
  const needsSnap =
    snapName &&
    norm(snapName) !== norm(target.name) &&
    resolveMasterForSnapshotName(snapName)?.id === target.id;
  if (needsId || needsSnap) {
    const snap = {
      ...(typeof c.doctor_snapshot === 'object' ? c.doctor_snapshot : {}),
      id: target.id,
      name: target.name,
      specialization: 'Surgeon',
      hospitalId: c.doctor_snapshot?.hospitalId ?? '',
      phone: c.doctor_snapshot?.phone ?? '',
    };
    caseUpdates.push({ id: c.id, case_number: c.case_number, doctor_id: target.id, doctor_snapshot: snap });
  }
}

function doctorRowPatch(m) {
  const patch = { name: m.name, specialization: 'Surgeon' };
  if (hasDoctorCodeColumn) {
    patch.doctor_code = m.code;
    patch.phone = '';
  } else {
    // Until add-doctor-code.sql is applied, store code in empty phone field.
    patch.phone = m.code;
  }
  return patch;
}

const toCreate = master.filter((m) => m.created);
const toDelete = [...unusedIds];
const orphanNames = toDelete.map((id) => allDoctors.find((d) => d.id === id)?.name).filter(Boolean);

console.log(`${dryRun ? '[DRY RUN]' : '[EXECUTE]'} Canonical doctors: ${master.length}`);
console.log(
  `doctor_code column: ${hasDoctorCodeColumn ? 'yes' : 'no — storing MLS-DOC in doctors.phone until migration'}`,
);
console.log(`Create new doctor rows: ${toCreate.length}`);
console.log(`Update doctor rows: ${master.length - toCreate.length}`);
console.log(`Delete orphan doctor rows: ${toDelete.length}`, orphanNames.length ? `(${orphanNames.join(', ')})` : '');
console.log(`Case doctor links to fix: ${caseUpdates.length}`);
console.log('');

for (const m of master) {
  console.log(`${m.code}\t${m.name}\t${m.id}${m.created ? ' (new)' : ''}`);
}

const csvPath = resolve(root, 'share/doctors-master-with-codes.csv');
const csv = [
  'doctor_code,name,doctor_uuid',
  ...master.map((m) => `"${m.code}","${m.name.replace(/"/g, '""')}","${m.id}"`),
].join('\n');
writeFileSync(csvPath, csv);
console.log(`\nWrote ${csvPath}`);

if (dryRun) process.exit(0);

if (hasDoctorCodeColumn) {
  for (const d of allDoctors) {
    const ph = (d.phone ?? '').trim();
    if (MLS_CODE.test(ph)) {
      const m = master.find((x) => x.id === d.id);
      if (m) {
        await sb.from('doctors').update({ doctor_code: m.code, phone: '' }).eq('id', d.id);
      }
    }
  }
}

for (const m of toCreate) {
  const rowPatch = doctorRowPatch(m);
  const { error } = await sb.from('doctors').insert({
    id: m.id,
    hospital_id: null,
    ...rowPatch,
  });
  if (error) {
    console.error('Create failed', m.name, error.message);
    process.exit(1);
  }
}

for (const m of master.filter((x) => !x.created)) {
  const patch = doctorRowPatch(m);
  const { error } = await sb.from('doctors').update(patch).eq('id', m.id);
  if (error) {
    console.error('Update failed', m.name, error.message);
    process.exit(1);
  }
}

for (const u of caseUpdates) {
  const { error } = await sb
    .from('cases')
    .update({ doctor_id: u.doctor_id, doctor_snapshot: u.doctor_snapshot })
    .eq('id', u.id);
  if (error) {
    console.error('Case update failed', u.case_number, error.message);
    process.exit(1);
  }
}

for (const id of toDelete) {
  const stillLinked = (cases ?? []).some((c) => c.doctor_id === id);
  if (stillLinked) {
    console.error('Refusing to delete doctor still linked:', id);
    process.exit(1);
  }
  const { error } = await sb.from('doctors').delete().eq('id', id);
  if (error) {
    console.error('Delete failed', id, error.message);
    process.exit(1);
  }
}

const settingsPayload = {
  key: 'doctor_master_list',
  value: JSON.stringify(
    master.map((m) => ({ code: m.code, name: m.name, id: m.id })),
  ),
};
const { error: se } = await sb.from('app_settings').upsert(settingsPayload, { onConflict: 'key' });
if (se) {
  console.error('app_settings upsert failed:', se.message);
  process.exit(1);
}

console.log('\nDone — doctors synced and MLS-DOC codes saved (DB column + app_settings).');

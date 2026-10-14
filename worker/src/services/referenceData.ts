import { asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  appSettings,
  departments,
  doctors,
  hospitals,
  surgicalKits,
} from '../db/schema';

const HOSPITAL_COLUMNS = {
  id: hospitals.id,
  name: hospitals.name,
  branch: hospitals.branch,
  address: hospitals.address,
  city: hospitals.city,
  contactPerson: hospitals.contactPerson,
  phone: hospitals.phone,
  email: hospitals.email,
  status: hospitals.status,
} as const;

const DOCTOR_COLUMNS = {
  id: doctors.id,
  name: doctors.name,
  specialization: doctors.specialization,
  hospitalId: doctors.hospitalId,
  phone: doctors.phone,
  doctorCode: doctors.doctorCode,
} as const;

export async function countHospitals(db: Db): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(hospitals);
  return Number(rows[0]?.c ?? 0);
}

export async function listHospitals(db: Db, offset: number, limit: number) {
  const rows = await db
    .select(HOSPITAL_COLUMNS)
    .from(hospitals)
    .orderBy(asc(hospitals.name))
    .offset(offset)
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    branch: r.branch,
    address: r.address,
    city: r.city,
    contact_person: r.contactPerson,
    phone: r.phone,
    email: r.email,
    status: r.status,
  }));
}

export async function countDoctors(db: Db): Promise<number> {
  const rows = await db.select({ c: sql<number>`count(*)` }).from(doctors);
  return Number(rows[0]?.c ?? 0);
}

async function doctorCodeMapFromSettings(db: Db): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, 'doctor_master_list'))
    .limit(1);
  const raw = rows[0]?.value;
  if (!raw) return map;
  try {
    const list = JSON.parse(raw) as { id?: string; code?: string }[];
    for (const row of list) {
      if (row.id && row.code) map.set(row.id, row.code);
    }
  } catch {
    /* ignore */
  }
  return map;
}

export async function listDoctors(db: Db, offset: number, limit: number) {
  const codeById = await doctorCodeMapFromSettings(db);
  const rows = await db
    .select(DOCTOR_COLUMNS)
    .from(doctors)
    .orderBy(asc(doctors.name))
    .offset(offset)
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    specialization: r.specialization,
    hospital_id: r.hospitalId,
    phone: r.phone,
    doctor_code: r.doctorCode,
    master_list_code: codeById.get(r.id) ?? null,
  }));
}

export async function listDepartments(db: Db) {
  const rows = await db
    .select({
      id: departments.id,
      name: departments.name,
      description: departments.description,
      color: departments.color,
    })
    .from(departments)
    .orderBy(asc(departments.name))
    .limit(200);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    color: r.color,
  }));
}

export async function listSurgicalKits(db: Db) {
  const rows = await db
    .select({
      id: surgicalKits.id,
      name: surgicalKits.name,
      type: surgicalKits.type,
      serialNumber: surgicalKits.serialNumber,
      status: surgicalKits.status,
      lastUsedDate: surgicalKits.lastUsedDate,
    })
    .from(surgicalKits)
    .orderBy(asc(surgicalKits.name))
    .limit(500);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    serial_number: r.serialNumber,
    status: r.status,
    last_used_date: r.lastUsedDate,
  }));
}

export async function listAppSettings(db: Db): Promise<Record<string, string>> {
  const rows = await db.select({ key: appSettings.key, value: appSettings.value }).from(appSettings).limit(200);
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

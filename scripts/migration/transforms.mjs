/** PG → D1 value transforms for JSONL import. */

const MONEY_TO_MINOR = new Set([
  'invoice_amount',
  'collected_amount',
  'amount', // petrol_requests.amount in PG export
]);

const MONEY_MINOR_COLUMNS = new Set([
  'invoice_amount_minor',
  'collected_amount_minor',
  'amount_minor',
]);

/** Columns stored as JSON text in D1 */
const JSON_TEXT_COLUMNS = new Set([
  'departments',
  'hospital_snapshot',
  'doctor_snapshot',
  'assigned_employee_snapshot',
  'post_surgery_duties',
  'stages',
  'activity_logs',
  'comments',
  'data',
  'form_data',
  'checkpoints',
  'tags',
]);

const BOOLEAN_COLUMNS = new Set([
  'is_read',
  'within_office',
  'breakfast',
  'lunch',
  'dinner',
  'esi_eligible',
  'esi_generated',
]);

export function pgNumericToMinor(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

/**
 * Normalize one row from PG-shaped export to D1 column names/values.
 * @param {string} table
 * @param {Record<string, unknown>} row
 * @param {{ source?: 'postgres'|'synthetic' }} opts
 */
export function normalizeRowForD1(table, row, opts = {}) {
  const out = { ...row };
  const source = opts.source ?? 'postgres';

  if (source === 'postgres' && table === 'cases') {
    if ('invoice_amount' in out) {
      out.invoice_amount_minor = pgNumericToMinor(out.invoice_amount);
      delete out.invoice_amount;
    }
    if ('collected_amount' in out) {
      out.collected_amount_minor = pgNumericToMinor(out.collected_amount);
      delete out.collected_amount;
    }
  }

  if (source === 'postgres' && table === 'petrol_requests' && 'amount' in out) {
    out.amount_minor = pgNumericToMinor(out.amount);
    delete out.amount;
  }

  // PG leave_requests has no updated_at; D1 NOT NULL — mirror created_at when absent in export.
  if (source === 'postgres' && table === 'leave_requests' && out.updated_at == null && out.created_at != null) {
    out.updated_at = out.created_at;
  }

  for (const [key, val] of Object.entries(out)) {
    if (val === null || val === undefined) continue;

    if (BOOLEAN_COLUMNS.has(key) && typeof val === 'boolean') {
      out[key] = val ? 1 : 0;
    }

    if (JSON_TEXT_COLUMNS.has(key) && typeof val === 'object') {
      out[key] = JSON.stringify(val);
    }

    if (key === 'tags' && Array.isArray(val)) {
      out[key] = JSON.stringify(val);
    }
  }

  return out;
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

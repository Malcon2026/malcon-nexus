/** Shared CSV parser for Node scripts — matches src/utils/csv.ts behavior. */

export function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseCsvRows(text) {
  const input = stripBom(text);
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(cell.trim());
      cell = '';
    } else if (char === '\r' && next === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
      i += 1;
    } else if (char === '\n') {
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim());
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c !== ''));
}

export function parseCsvObjects(text, { requiredColumns = [] } = {}) {
  const rows = parseCsvRows(text)
    .map((line) => line.map((v) => v.trim()))
    .filter((line) => line.length > 0 && !line[0].startsWith('#'));

  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  for (const col of requiredColumns) {
    if (!headers.includes(col.toLowerCase())) {
      throw new Error(`Missing required column "${col}". Found: ${headers.join(', ')}`);
    }
  }

  return rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    record._line = index + 2;
    return record;
  });
}

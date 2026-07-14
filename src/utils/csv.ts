/** RFC 4180 CSV parse + export with Excel-friendly UTF-8 BOM. */

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function escapeCsvCell(value: unknown): string {
  const str = value == null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]): void {
  const csv = rowsToCsv(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/** Parse CSV text into rows of string cells (handles quotes, commas, newlines). */
export function parseCsvRows(text: string): string[][] {
  const input = stripBom(text);
  const rows: string[][] = [];
  let row: string[] = [];
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

export function parseCsvObjects<T extends Record<string, string>>(
  text: string,
  options?: { requiredColumns?: string[] },
): T[] {
  const rows = parseCsvRows(text)
    .map((line) => line.map((v) => v.trim()))
    .filter((line) => line.length > 0 && !line[0].startsWith('#'));

  if (rows.length < 2) {
    throw new Error('CSV must include a header row and at least one data row.');
  }

  const headers = rows[0].map((h) => h.toLowerCase());
  const required = options?.requiredColumns ?? [];
  for (const col of required) {
    if (!headers.includes(col.toLowerCase())) {
      throw new Error(`Missing required column "${col}". Found: ${headers.join(', ')}`);
    }
  }

  return rows.slice(1).map((values, index) => {
    const record = Object.fromEntries(
      headers.map((header, i) => [header, values[i] ?? '']),
    ) as T;
    (record as T & { _line: number })._line = index + 2;
    return record;
  });
}

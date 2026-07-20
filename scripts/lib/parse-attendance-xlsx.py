#!/usr/bin/env python3
"""Parse Malcon attendance xlsx → JSON on stdout.

Usage:
  python3 scripts/lib/parse-attendance-xlsx.py "EMP ATTENDANCE MAY-2026.xlsx" 2026 5
  python3 scripts/lib/parse-attendance-xlsx.py "EMP ATTENDANCE JUNE-2026.xlsx" 2026 6
"""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from attendance_excel_mapping import EXCEL_TO_EMAIL


def norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().upper())


def col_idx(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def parse_sheet(xlsx: Path, salary_year: int, salary_month: int) -> dict:
    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    with zipfile.ZipFile(xlsx) as z:
        shared = []
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall("main:si", ns):
            shared.append("".join((t.text or "") for t in si.findall(".//main:t", ns)))

        sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
        rows = []
        for row in sheet.findall("main:sheetData/main:row", ns):
            cells = {}
            for c in row.findall("main:c", ns):
                col = re.match(r"([A-Z]+)", c.get("r", "")).group(1)
                v = c.find("main:v", ns)
                if v is None:
                    continue
                val = shared[int(v.text)] if c.get("t") == "s" else v.text
                cells[col] = str(val).strip()
            rows.append(cells)

    r1, r2 = rows[0], rows[1]
    all_header_cols = sorted(set(r1.keys()) | set(r2.keys()), key=col_idx)

    day_cols = []
    for col in all_header_cols:
        day_val = r2.get(col, "")
        if not day_val.isdigit():
            if day_cols:
                break
            continue
        day_cols.append(col)

    prev_month = salary_month - 1 if salary_month > 1 else 12
    prev_year = salary_year if salary_month > 1 else salary_year - 1

    year = prev_year
    month = prev_month
    prev_day = None
    columns = []
    for col in day_cols:
        day = int(r2[col])
        if prev_day is not None and day < prev_day:
            month += 1
            if month > 12:
                month = 1
                year += 1
        date_key = f"{year}-{month:02d}-{day:02d}"
        weekday = r1.get(col, "").upper()
        columns.append({"col": col, "day": day, "dateKey": date_key, "weekday": weekday})
        prev_day = day

    email_by_norm = {norm_name(k): v for k, v in EXCEL_TO_EMAIL.items()}

    entries = []
    skipped_names = []

    for cells in rows[2:]:
        raw_name = cells.get("C", "").strip()
        if not raw_name or raw_name.lower() == "name":
            continue

        n = norm_name(raw_name)
        email = email_by_norm.get(n)
        if not email:
            skipped_names.append(raw_name)
            continue

        days = []
        for col_meta in columns:
            raw = cells.get(col_meta["col"], "").strip().upper()
            if raw in ("P", "P/2"):
                status = "P"
            elif raw in ("L", "E"):
                status = "L"
            elif raw == "":
                if "SUN" in col_meta["weekday"]:
                    status = "WO"
                else:
                    status = "A"
            else:
                status = "SKIP"

            if status in ("P", "L"):
                days.append({"dateKey": col_meta["dateKey"], "status": status})

        entries.append(
            {
                "excelName": raw_name,
                "email": email,
                "empNum": cells.get("B", ""),
                "days": days,
            }
        )

    return {
        "salaryMonth": f"{salary_year}-{salary_month:02d}",
        "columns": columns,
        "entries": entries,
        "skippedNames": skipped_names,
    }


def main() -> None:
    if len(sys.argv) != 4:
        print(json.dumps({"error": "Usage: parse-attendance-xlsx.py <xlsx> <year> <salaryMonth>"}))
        sys.exit(1)

    xlsx = Path(sys.argv[1])
    if not xlsx.is_absolute():
        xlsx = Path.cwd() / xlsx
    if not xlsx.exists():
        print(json.dumps({"error": f"Missing file: {xlsx}"}))
        sys.exit(1)

    salary_year = int(sys.argv[2])
    salary_month = int(sys.argv[3])

    print(json.dumps(parse_sheet(xlsx, salary_year, salary_month)))


if __name__ == "__main__":
    main()

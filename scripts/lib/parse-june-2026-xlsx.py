#!/usr/bin/env python3
"""Parse EMP ATTENDANCE JUNE-2026.xlsx → JSON on stdout."""

import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / "EMP ATTENDANCE JUNE-2026.xlsx"

EXCEL_TO_EMAIL = {
    "PREETHAM TAILAM": "preetam.tailam@malconnexus.com",
    "GAJELLI CHANDRA PRANEETH": "chandra.gajelli@malconnexus.com",
    "JERIPOTHULA VIJAYKUMAR": "vijaykumar.jeripothula@malconnexus.com",
    "JILLALA SURYA": "surya.jillala@malconnexus.com",
    "ADIRE SRIVANI": "srivani.adire@malconnexus.com",
    "PERUMANDLA RAMAKANTH": "ramakanth.perumandla@malconnexus.com",
    "BASHABOINA SHIVAJI": "shivaji.bashaboina@malconnexus.com",
    "J.NITHIN": "nithin.janoth@malconnexus.com",
    "PATAKULA SAI": "sai.patakaula@malconnexus.com",
    "A.JEEVAN": "jeevan.anishetti@malconnexus.com",
    "BURLAWAR VINEETH GOUD": "vinithgoud.burlawar@malconnexus.com",
    "JERIPOTHULA SAI KRISHNA": "saikrishna.jeripothula@malconnexus.com",
    "S.RACHITHA SAI": "rachitha.abburi@malconnexus.com",
}


def norm_name(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip().upper())


def col_idx(col: str) -> int:
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n


def main() -> None:
    if not XLSX.exists():
        print(json.dumps({"error": f"Missing file: {XLSX}"}))
        sys.exit(1)

    ns = {"main": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

    with zipfile.ZipFile(XLSX) as z:
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
    day_cols = sorted(
        [c for c in r2.keys() if c >= "H" and r2.get(c, "").isdigit()],
        key=col_idx,
    )

    year = 2026
    month = 5
    prev_day = None
    columns = []
    for col in day_cols:
        day = int(r2[col])
        if prev_day is not None and day < prev_day:
            month = 6
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
            elif raw == "L":
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

    print(
        json.dumps(
            {
                "salaryMonth": "2026-06",
                "columns": columns,
                "entries": entries,
                "skippedNames": skipped_names,
            }
        )
    )


if __name__ == "__main__":
    main()

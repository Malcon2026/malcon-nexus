#!/usr/bin/env python3
"""Backward-compatible wrapper — use parse-attendance-xlsx.py for new imports."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
XLSX = ROOT / "EMP ATTENDANCE JUNE-2026.xlsx"
PARSER = Path(__file__).resolve().parent / "parse-attendance-xlsx.py"

if __name__ == "__main__":
    subprocess.run(
        [sys.executable, str(PARSER), str(XLSX), "2026", "6"],
        check=True,
    )

"""Export the landing-page lab data as an offline snapshot for the frontend.

Run after changing any factor dataset or engine logic:

    python scripts/export_lab_snapshot.py

The landing page uses the live /api/lab response when the backend is running
and falls back to this snapshot otherwise, so it must come from the engine.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.services.landing_lab import build_lab  # noqa: E402

target = ROOT.parent / "frontend" / "src" / "features" / "landing" / "labSnapshot.json"
target.write_text(json.dumps(build_lab(), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"Wrote {target}")

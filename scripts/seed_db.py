"""
Operational Utility Script: Seed & Ingest Warehouse Database
============================================================
Runs canonical database seeding and ingestion directly from project root.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
backend_dir = PROJECT_ROOT / "backend"

for p in [PROJECT_ROOT, backend_dir]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

if __name__ == "__main__":
    from backend.seed_database import reset_and_seed
    reset_and_seed()

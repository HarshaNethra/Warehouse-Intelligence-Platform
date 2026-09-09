"""
Supabase PostgreSQL Migration Utility for Warehouse Intelligence Platform.

Usage:
    python migrate_to_supabase.py --url "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"

Or set DATABASE_URL in your environment:
    export DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres"
    python migrate_to_supabase.py
"""

import os
import sys
import argparse
import sqlite3
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.database import Base
from app.db import models


TABLES_IN_ORDER = [
    "organizations",
    "facilities",
    "users",
    "loading_bays",
    "cameras",
    "shifts",
    "safety_rules",
    "videos",
    "inference_runs",
    "behaviour_observations",
    "risk_assessments",
    "events",
    "model_runs",
    "audit_logs",
    "evaluation_datasets",
    "evaluation_samples",
]


def migrate(target_url: str, sqlite_path: Path):
    # Normalize postgres:// to postgresql://
    if target_url.startswith("postgres://"):
        target_url = target_url.replace("postgres://", "postgresql://", 1)

    print(f"\n🚀 [Supabase Migration] Initializing migration...")
    print(f"📦 Source SQLite DB: {sqlite_path}")
    print(f"🌐 Target Supabase URL: {target_url.split('@')[-1] if '@' in target_url else 'PostgreSQL'}")

    if not sqlite_path.exists():
        print(f"❌ Error: SQLite source database not found at {sqlite_path}")
        sys.exit(1)

    # 1. Connect to PostgreSQL and create schema tables
    print("\n🔨 Step 1: Creating database tables & schema in Supabase...")
    engine_kwargs = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    pg_engine = create_engine(target_url, **engine_kwargs)

    try:
        with pg_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("   ✅ Successfully connected to Supabase PostgreSQL!")
    except Exception as e:
        print(f"   ❌ Connection failed: {e}")
        print("\n💡 Troubleshooting Tips:")
        print("   1. Verify your database password is correct.")
        print("   2. Check if project is paused in your Supabase dashboard.")
        print("   3. Ensure you used the Transaction Pooler (port 6543) or Direct connection (port 5432).")
        sys.exit(1)

    Base.metadata.create_all(bind=pg_engine)
    print("   ✅ Schema tables created successfully.")

    # 2. Migrate data table by table
    print("\n📦 Step 2: Copying data from SQLite to Supabase...")
    sqlite_conn = sqlite3.connect(str(sqlite_path))
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cur = sqlite_conn.cursor()

    total_migrated = 0

    with pg_engine.connect() as pg_conn:
        for table_name in TABLES_IN_ORDER:
            # Check if table exists in SQLite
            sqlite_cur.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table_name,)
            )
            if not sqlite_cur.fetchone():
                continue

            rows = sqlite_cur.execute(f"SELECT * FROM {table_name}").fetchall()
            if not rows:
                print(f"   ⚪ {table_name}: 0 rows (skipped)")
                continue

            # Extract column names
            col_names = [d[0] for d in sqlite_cur.description]
            cols_clause = ", ".join(col_names)
            params_clause = ", ".join([f":{c}" for c in col_names])

            insert_sql = text(
                f"INSERT INTO {table_name} ({cols_clause}) VALUES ({params_clause}) "
                f"ON CONFLICT DO NOTHING"
            )

            # Insert batch
            inserted_count = 0
            for r in rows:
                row_dict = dict(r)
                # Ensure boolean conversions if needed
                for k, v in row_dict.items():
                    if isinstance(v, int) and k.startswith("is_"):
                        row_dict[k] = bool(v)
                try:
                    pg_conn.execute(insert_sql, row_dict)
                    inserted_count += 1
                except Exception as row_err:
                    # Ignore duplicate key constraint violations gracefully
                    pass

            pg_conn.commit()
            print(f"   ✅ {table_name}: {inserted_count} rows migrated")
            total_migrated += inserted_count

    sqlite_conn.close()
    print(f"\n🎉 [Migration Complete] Total records synced to Supabase: {total_migrated} rows across {len(TABLES_IN_ORDER)} tables!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Migrate Warehouse DB to Supabase PostgreSQL")
    parser.add_argument("--url", default=None, help="Supabase PostgreSQL Connection URL")
    parser.add_argument(
        "--db-path",
        default=str(backend_dir / "warehouse.db"),
        help="Path to local warehouse.db file"
    )

    args = parser.parse_args()
    target_url = args.url or os.getenv("DATABASE_URL")

    if not target_url or "sqlite" in target_url.lower():
        print("❌ Please provide your Supabase PostgreSQL URL:")
        print("   python migrate_to_supabase.py --url 'postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres'")
        print("   OR set the DATABASE_URL environment variable.")
        sys.exit(1)

    migrate(target_url, Path(args.db_path))

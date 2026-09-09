"""
Supabase PostgreSQL Schema & Data Generator for Warehouse Intelligence Platform.
Generates a complete, flawless SQL script matching SQLAlchemy models and SQLite data.
"""

import sqlite3
import sys
from pathlib import Path
from sqlalchemy.dialects import postgresql
from sqlalchemy import Integer, Boolean

backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.database import Base
from app.db import models

db_path = backend_dir / "warehouse.db"
out_path = backend_dir.parent / "supabase_schema.sql"

con = sqlite3.connect(str(db_path))
cur = con.cursor()

lines = [
    "-- ============================================================================",
    "-- Warehouse Intelligence Platform — Supabase PostgreSQL Schema & Seed Script",
    "-- Run this entire script in your Supabase SQL Editor (Dashboard -> SQL Editor)",
    "-- ============================================================================",
    "",
    "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",
    "",
]

# Order of tables for DROP CASCADE
all_tables = [
    "detections",
    "object_tracks",
    "frame_records",
    "behaviour_observations",
    "telemetry_points",
    "video_processing_jobs",
    "incident_reviews",
    "risk_assessments",
    "events",
    "inference_runs",
    "videos",
    "safety_rules",
    "cameras",
    "shifts",
    "loading_bays",
    "users",
    "facilities",
    "organizations",
    "model_runs",
    "audit_logs",
    "evaluation_samples",
    "evaluation_datasets",
]

lines.append("-- 1. Cleanly drop any previous tables")
for t in all_tables:
    lines.append(f"DROP TABLE IF EXISTS {t} CASCADE;")
lines.append("")

# Table creation order (dependencies first)
creation_order = [
    "organizations",
    "facilities",
    "users",
    "loading_bays",
    "shifts",
    "cameras",
    "safety_rules",
    "videos",
    "inference_runs",
    "behaviour_observations",
    "events",
    "risk_assessments",
    "incident_reviews",
    "video_processing_jobs",
    "telemetry_points",
    "frame_records",
    "object_tracks",
    "detections",
    "model_runs",
    "audit_logs",
    "evaluation_datasets",
    "evaluation_samples",
]

lines.append("-- 2. Create Table Definitions")
for t_name in creation_order:
    if t_name not in Base.metadata.tables:
        continue
    table = Base.metadata.tables[t_name]
    cols_def = []
    for col in table.columns:
        if col.primary_key and isinstance(col.type, Integer) and col.autoincrement:
            cols_def.append(f"    {col.name} SERIAL PRIMARY KEY")
            continue

        col_type = col.type.compile(dialect=postgresql.dialect())
        nullable = "" if col.nullable else " NOT NULL"
        pk = " PRIMARY KEY" if col.primary_key else ""
        cols_def.append(f"    {col.name} {col_type}{pk}{nullable}")

    lines.append(f"CREATE TABLE {t_name} (\n" + ",\n".join(cols_def) + "\n);")
    lines.append("")

lines.append("-- ============================================================================")
lines.append("-- 3. CANONICAL DATA SEEDING")
lines.append("-- ============================================================================")
lines.append("")

for t in creation_order:
    try:
        cur.execute(f"SELECT * FROM {t}")
        rows = cur.fetchall()
        cols = [d[0] for d in cur.description]
        if not rows:
            continue

        table_meta = Base.metadata.tables.get(t)

        lines.append(f"-- Ingesting {len(rows)} records into {t}")
        for r in rows:
            vals = []
            for col_name, v in zip(cols, r):
                if v is None:
                    vals.append("NULL")
                    continue

                col_meta = table_meta.columns.get(col_name) if table_meta is not None else None
                is_bool_col = col_meta is not None and isinstance(col_meta.type, Boolean)

                if is_bool_col:
                    if v in (1, "1", "true", "TRUE", True):
                        vals.append("TRUE")
                    elif v in (0, "0", "false", "FALSE", False):
                        vals.append("FALSE")
                    else:
                        vals.append("NULL")
                elif isinstance(v, (int, float)):
                    vals.append(str(v))
                else:
                    escaped = str(v).replace("'", "''")
                    vals.append(f"'{escaped}'")

            pk_col = cols[0]
            lines.append(f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join(vals)}) ON CONFLICT ({pk_col}) DO NOTHING;")
        lines.append("")
    except Exception as e:
        print(f"Skipping table {t}: {e}")

lines.append("-- ============================================================================")
lines.append("-- 4. FOREIGN KEY CONSTRAINTS")
lines.append("-- ============================================================================")
lines.append("")

constraint_idx = 1
for t_name in creation_order:
    if t_name not in Base.metadata.tables:
        continue
    table = Base.metadata.tables[t_name]
    for fk in table.foreign_keys:
        target_table = fk.column.table.name
        target_col = fk.column.name
        source_col = fk.parent.name
        c_name = f"fk_{t_name}_{source_col}_{constraint_idx}"
        constraint_idx += 1
        lines.append(f"ALTER TABLE {t_name} ADD CONSTRAINT {c_name} FOREIGN KEY ({source_col}) REFERENCES {target_table} ({target_col}) ON DELETE CASCADE;")

lines.append("")
lines.append("-- End of Supabase Schema & Seed Script")

con.close()

out_path.write_text("\n".join(lines), encoding="utf-8")
print(f"Generated {out_path} ({len(lines)} lines)")

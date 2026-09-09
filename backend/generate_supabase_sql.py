import sqlite3
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
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
    "-- 1. Organizations",
    """CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR PRIMARY KEY,
    name VARCHAR NOT NULL,
    subscription_tier VARCHAR DEFAULT 'ENTERPRISE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 2. Facilities",
    """CREATE TABLE IF NOT EXISTS facilities (
    id VARCHAR PRIMARY KEY,
    organization_id VARCHAR REFERENCES organizations(id),
    name VARCHAR NOT NULL,
    location VARCHAR,
    timezone VARCHAR DEFAULT 'Asia/Kolkata',
    status VARCHAR DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 3. Users",
    """CREATE TABLE IF NOT EXISTS users (
    id VARCHAR PRIMARY KEY,
    organization_id VARCHAR REFERENCES organizations(id),
    facility_id VARCHAR REFERENCES facilities(id),
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'SUPERVISOR',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 4. Loading Bays",
    """CREATE TABLE IF NOT EXISTS loading_bays (
    id VARCHAR PRIMARY KEY,
    facility_id VARCHAR REFERENCES facilities(id),
    name VARCHAR NOT NULL,
    code VARCHAR NOT NULL,
    status VARCHAR DEFAULT 'Operational',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 5. Cameras",
    """CREATE TABLE IF NOT EXISTS cameras (
    id VARCHAR PRIMARY KEY,
    loading_bay_id VARCHAR REFERENCES loading_bays(id),
    name VARCHAR NOT NULL,
    camera_code VARCHAR NOT NULL,
    source_type VARCHAR DEFAULT 'RTSP',
    stream_url VARCHAR,
    status VARCHAR DEFAULT 'ONLINE',
    last_seen_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 6. Safety Rules",
    """CREATE TABLE IF NOT EXISTS safety_rules (
    id VARCHAR PRIMARY KEY,
    facility_id VARCHAR REFERENCES facilities(id),
    behaviour_type VARCHAR NOT NULL,
    max_allowed_per_hour INTEGER DEFAULT 5,
    severity_weight FLOAT DEFAULT 1.0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 7. Videos",
    """CREATE TABLE IF NOT EXISTS videos (
    video_id VARCHAR PRIMARY KEY,
    camera_id VARCHAR,
    filename VARCHAR NOT NULL,
    duration FLOAT DEFAULT 0.0,
    fps FLOAT DEFAULT 30.0,
    width INTEGER DEFAULT 1920,
    height INTEGER DEFAULT 1080,
    frame_count INTEGER DEFAULT 0,
    status VARCHAR DEFAULT 'processed',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 8. Events",
    """CREATE TABLE IF NOT EXISTS events (
    event_id VARCHAR PRIMARY KEY,
    organization_id VARCHAR,
    facility_id VARCHAR,
    video_id VARCHAR,
    timestamp FLOAT NOT NULL,
    timestamp_seconds FLOAT DEFAULT 0.0,
    camera_id VARCHAR,
    bay_id VARCHAR,
    object_id INTEGER DEFAULT 1,
    behaviour VARCHAR NOT NULL,
    risk_level VARCHAR NOT NULL,
    risk_score FLOAT NOT NULL,
    description TEXT,
    reason TEXT,
    recommended_action TEXT,
    evidence_frame VARCHAR,
    video_reference VARCHAR,
    status VARCHAR DEFAULT 'UNRESOLVED',
    acknowledged_by VARCHAR,
    dispatched_to VARCHAR,
    dispatch_notes TEXT,
    provenance_type VARCHAR DEFAULT 'REAL_INFERENCE',
    environment VARCHAR DEFAULT 'PRODUCTION_PROTOTYPE',
    confidence FLOAT DEFAULT 0.94,
    model_name VARCHAR DEFAULT 'YOLO11s',
    model_version VARCHAR DEFAULT 'v1.4.2-tensorrt',
    is_demo_data BOOLEAN DEFAULT FALSE,
    is_test_data BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 9. Risk Assessments",
    """CREATE TABLE IF NOT EXISTS risk_assessments (
    id VARCHAR PRIMARY KEY,
    event_id VARCHAR,
    behaviour_observation_id VARCHAR,
    risk_level VARCHAR NOT NULL,
    risk_score FLOAT NOT NULL,
    confidence FLOAT DEFAULT 0.94,
    reason TEXT,
    risk_factors_json TEXT,
    model_version VARCHAR DEFAULT 'warehouse-risk-v1.4',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);""",
    "",
    "-- 10. Model Runs Telemetry",
    """CREATE TABLE IF NOT EXISTS model_runs (
    id VARCHAR PRIMARY KEY,
    model_name VARCHAR NOT NULL,
    model_version VARCHAR NOT NULL,
    device VARCHAR DEFAULT 'cuda',
    fps FLOAT DEFAULT 89.4,
    latency_ms FLOAT DEFAULT 11.2,
    confidence_threshold FLOAT DEFAULT 0.45,
    started_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR DEFAULT 'RUNNING'
);""",
    "",
    "-- ============================================================================",
    "-- DATA INGESTION & CANONICAL SEED RECORDS",
    "-- ============================================================================",
    ""
]

tables_order = ['organizations', 'facilities', 'users', 'loading_bays', 'cameras', 'safety_rules', 'videos', 'events']

for t in tables_order:
    cur.execute(f"SELECT * FROM {t}")
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    lines.append(f"-- Ingesting {len(rows)} records into {t}")
    for r in rows:
        vals = []
        for col_name, v in zip(cols, r):
            if v is None:
                vals.append("NULL")
            elif isinstance(v, bool):
                vals.append("TRUE" if v else "FALSE")
            elif isinstance(v, (int, float)):
                vals.append(str(v))
            else:
                escaped = str(v).replace("'", "''")
                vals.append(f"'{escaped}'")
        lines.append(f"INSERT INTO {t} ({', '.join(cols)}) VALUES ({', '.join(vals)}) ON CONFLICT ({(cols[0])}) DO NOTHING;")
    lines.append("")

con.close()

out_path.write_text("\n".join(lines), encoding="utf-8")
print(f"Generated {out_path} ({len(lines)} lines)")

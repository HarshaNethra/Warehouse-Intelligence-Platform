import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import datetime
import json
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.db import models
from app.core import security
from app.config import settings, AppEnvironment

DEFAULT_ORG_ID = "ORG-001"
DEFAULT_FACILITY_ID = "FAC-001"
SECONDARY_FACILITY_ID = "FAC-002"


def ensure_columns_exist(db: Session) -> None:
    """
    Ensures all database tables and new columns exist without dropping existing SQLite data.
    """
    try:
        from app.db.database import engine, Base
        Base.metadata.create_all(bind=engine)
        
        bind = db.get_bind()
        with bind.connect() as conn:
            # Safely check events columns
            result = conn.execute(text("PRAGMA table_info(events)"))
            existing_cols = [row[1] for row in result.fetchall()]

            if existing_cols:
                cols_to_add = [
                    ("organization_id", "VARCHAR"),
                    ("facility_id", "VARCHAR"),
                    ("status", "VARCHAR DEFAULT 'UNRESOLVED'"),
                    ("acknowledged_by_user_id", "VARCHAR"),
                    ("acknowledged_at", "DATETIME"),
                    ("model_name", "VARCHAR DEFAULT 'YOLO11s'"),
                    ("model_version", "VARCHAR DEFAULT 'v1.4.2-tensorrt'"),
                    ("inference_engine", "VARCHAR DEFAULT 'LOCAL_YOLO11'"),
                    ("confidence", "FLOAT DEFAULT 0.92"),
                    ("rule_version", "VARCHAR DEFAULT 'RULE-v1.0'"),
                    ("provenance_type", "VARCHAR DEFAULT 'DEVELOPMENT_SEED'"),
                    ("inference_run_id", "VARCHAR"),
                    ("risk_assessment_id", "VARCHAR"),
                    ("behaviour_observation_id", "VARCHAR"),
                    ("frame_number", "INTEGER"),
                    ("video_fps", "FLOAT DEFAULT 30.0"),
                    ("timestamp_seconds", "FLOAT"),
                    ("timestamp_utc", "DATETIME"),
                    ("evidence_clip_start", "FLOAT"),
                    ("evidence_clip_end", "FLOAT"),
                    ("processing_latency_ms", "FLOAT"),
                    ("updated_at", "DATETIME"),
                    ("environment", "VARCHAR DEFAULT 'DEVELOPMENT'"),
                    ("is_test_data", "BOOLEAN DEFAULT 0"),
                    ("is_demo_data", "BOOLEAN DEFAULT 0")
                ]
                for col_name, col_type in cols_to_add:
                    if col_name not in existing_cols:
                        conn.execute(text(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                        print(f"[Seed] Migrated column: events.{col_name}")
                        
            # Safely check users columns
            res_users = conn.execute(text("PRAGMA table_info(users)"))
            user_cols = [row[1] for row in res_users.fetchall()]
            if user_cols:
                if "organization_id" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN organization_id VARCHAR"))
                    conn.commit()
                    print("[Seed] Migrated column: users.organization_id")
                if "updated_at" not in user_cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN updated_at DATETIME"))
                    conn.commit()
                    print("[Seed] Migrated column: users.updated_at")

            # Safely check facilities columns
            res_fac = conn.execute(text("PRAGMA table_info(facilities)"))
            fac_cols = [row[1] for row in res_fac.fetchall()]
            if fac_cols:
                if "organization_id" not in fac_cols:
                    conn.execute(text("ALTER TABLE facilities ADD COLUMN organization_id VARCHAR"))
                    conn.commit()
                    print("[Seed] Migrated column: facilities.organization_id")
                if "timezone" not in fac_cols:
                    conn.execute(text("ALTER TABLE facilities ADD COLUMN timezone VARCHAR DEFAULT 'Asia/Kolkata'"))
                    conn.commit()
                    print("[Seed] Migrated column: facilities.timezone")
                if "status" not in fac_cols:
                    conn.execute(text("ALTER TABLE facilities ADD COLUMN status VARCHAR DEFAULT 'ACTIVE'"))
                    conn.commit()
                    print("[Seed] Migrated column: facilities.status")

            # Safely check videos columns
            res_vid = conn.execute(text("PRAGMA table_info(videos)"))
            vid_cols = [row[1] for row in res_vid.fetchall()]
            if vid_cols:
                if "camera_id" not in vid_cols:
                    conn.execute(text("ALTER TABLE videos ADD COLUMN camera_id VARCHAR"))
                    conn.commit()
                    print("[Seed] Migrated column: videos.camera_id")
                if "uploaded_by_user_id" not in vid_cols:
                    conn.execute(text("ALTER TABLE videos ADD COLUMN uploaded_by_user_id VARCHAR"))
                    conn.commit()
                    print("[Seed] Migrated column: videos.uploaded_by_user_id")
                if "storage_key" not in vid_cols:
                    conn.execute(text("ALTER TABLE videos ADD COLUMN storage_key VARCHAR"))
                    conn.commit()
                    print("[Seed] Migrated column: videos.storage_key")
                if "mime_type" not in vid_cols:
                    conn.execute(text("ALTER TABLE videos ADD COLUMN mime_type VARCHAR DEFAULT 'video/mp4'"))
                    conn.commit()
                    print("[Seed] Migrated column: videos.mime_type")
                if "processed_at" not in vid_cols:
                    conn.execute(text("ALTER TABLE videos ADD COLUMN processed_at DATETIME"))
                    conn.commit()
                    print("[Seed] Migrated column: videos.processed_at")

            # Safely check inference_runs columns
            res_inf = conn.execute(text("PRAGMA table_info(inference_runs)"))
            inf_cols = [row[1] for row in res_inf.fetchall()]
            if inf_cols and "error_message" not in inf_cols:
                conn.execute(text("ALTER TABLE inference_runs ADD COLUMN error_message TEXT"))
                conn.commit()
                print("[Seed] Migrated column: inference_runs.error_message")

            # Safely check risk_assessments columns
            res_ra = conn.execute(text("PRAGMA table_info(risk_assessments)"))
            ra_cols = [row[1] for row in res_ra.fetchall()]
            if ra_cols and "behaviour_observation_id" not in ra_cols:
                conn.execute(text("ALTER TABLE risk_assessments ADD COLUMN behaviour_observation_id VARCHAR"))
                conn.commit()
                print("[Seed] Migrated column: risk_assessments.behaviour_observation_id")

            # Safely check detections columns
            res_det = conn.execute(text("PRAGMA table_info(detections)"))
            det_cols = [row[1] for row in res_det.fetchall()]
            if det_cols:
                if "inference_run_id" not in det_cols:
                    conn.execute(text("ALTER TABLE detections ADD COLUMN inference_run_id VARCHAR"))
                    conn.commit()
                if "frame_id" not in det_cols:
                    conn.execute(text("ALTER TABLE detections ADD COLUMN frame_id VARCHAR"))
                    conn.commit()

            # Safely check object_tracks columns
            res_trk = conn.execute(text("PRAGMA table_info(object_tracks)"))
            trk_cols = [row[1] for row in res_trk.fetchall()]
            if trk_cols and "inference_run_id" not in trk_cols:
                conn.execute(text("ALTER TABLE object_tracks ADD COLUMN inference_run_id VARCHAR"))
                conn.commit()

    except Exception as e:
        print(f"[Seed] Column migration check note: {e}")


def init_db(db: Session) -> None:
    """
    Initializes database seed data:
    1. Primary Organization: Acme Logistics Global
    2. Facilities: Bengaluru Distribution Center, Mumbai Hub
    3. Loading Bays (BAY-01 to BAY-04) & Cameras (CAM-01 to CAM-04)
    4. Safety Rules & Shifts
    5. Admin, Supervisor, Operator users
    6. Realistic behavior events & risk assessments
    7. Model runs & audit logs
    """
    print(f"[Seed] Running database initialization and seed routine (Environment: {settings.ENVIRONMENT.value})...")
    ensure_columns_exist(db)

    from app.config import AppEnvironment
    if settings.ENVIRONMENT == AppEnvironment.PRODUCTION:
        print("[Seed] PRODUCTION Environment detected. Skipping synthetic seed fixtures for data integrity.")
        return

    # 1. Create Organization
    org = db.query(models.Organization).filter(models.Organization.id == DEFAULT_ORG_ID).first()
    if not org:
        org = models.Organization(
            id=DEFAULT_ORG_ID,
            name="Acme Logistics Global",
            created_at=datetime.datetime.utcnow()
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        print(f"[Seed] Created Organization: {org.id} ({org.name})")

    # 2. Create Primary Facility (Bengaluru DC)
    facility = db.query(models.Facility).filter(models.Facility.id == DEFAULT_FACILITY_ID).first()
    if not facility:
        facility = models.Facility(
            id=DEFAULT_FACILITY_ID,
            organization_id=DEFAULT_ORG_ID,
            name="Bengaluru Distribution Center",
            location="Building A - Dock Bay 4, Peenya Industrial Area",
            timezone="Asia/Kolkata",
            status="ACTIVE",
            created_at=datetime.datetime.utcnow()
        )
        db.add(facility)
        db.commit()
        db.refresh(facility)
        print(f"[Seed] Created Facility: {facility.id} ({facility.name})")

    # Secondary Facility (Mumbai Hub)
    facility2 = db.query(models.Facility).filter(models.Facility.id == SECONDARY_FACILITY_ID).first()
    if not facility2:
        facility2 = models.Facility(
            id=SECONDARY_FACILITY_ID,
            organization_id=DEFAULT_ORG_ID,
            name="Mumbai Logistics Hub",
            location="Bhiwandi Dock Yard 09, Mumbai",
            timezone="Asia/Kolkata",
            status="ACTIVE",
            created_at=datetime.datetime.utcnow()
        )
        db.add(facility2)
        db.commit()

    # 3. Seed Loading Bays
    bays_data = [
        {"id": "BAY-01", "facility_id": DEFAULT_FACILITY_ID, "name": "Loading Bay 01", "code": "BAY-01-EXP", "status": "Operational"},
        {"id": "BAY-02", "facility_id": DEFAULT_FACILITY_ID, "name": "Loading Bay 02", "code": "BAY-02-IMP", "status": "Monitoring"},
        {"id": "BAY-03", "facility_id": DEFAULT_FACILITY_ID, "name": "Loading Bay 03", "code": "BAY-03-STG", "status": "Operational"},
        {"id": "BAY-04", "facility_id": DEFAULT_FACILITY_ID, "name": "Loading Bay 04", "code": "BAY-04-HEV", "status": "Maintenance"},
        {"id": "BAY-05", "facility_id": SECONDARY_FACILITY_ID, "name": "Loading Bay 05", "code": "BAY-05-MUM", "status": "Operational"},
        {"id": "BAY-06", "facility_id": SECONDARY_FACILITY_ID, "name": "Loading Bay 06", "code": "BAY-06-MUM", "status": "Monitoring"}
    ]
    for b in bays_data:
        bay = db.query(models.LoadingBay).filter(models.LoadingBay.id == b["id"]).first()
        if not bay:
            db.add(models.LoadingBay(
                id=b["id"],
                facility_id=b["facility_id"],
                name=b["name"],
                code=b["code"],
                status=b["status"],
                created_at=datetime.datetime.utcnow()
            ))
    db.commit()

    # 4. Seed Cameras
    cams_data = [
        {"id": "CAM-01", "bay_id": "BAY-01", "name": "Camera 01 - Dock Overhead", "code": "CAM-01-HD", "status": "ONLINE"},
        {"id": "CAM-02", "bay_id": "BAY-02", "name": "Camera 02 - Ramp Angle", "code": "CAM-02-HD", "status": "ONLINE"},
        {"id": "CAM-03", "bay_id": "BAY-03", "name": "Camera 03 - Staging Area", "code": "CAM-03-HD", "status": "DEGRADED"},
        {"id": "CAM-04", "bay_id": "BAY-04", "name": "Camera 04 - Heavy Loading", "code": "CAM-04-HD", "status": "OFFLINE"},
        {"id": "CAM-05", "bay_id": "BAY-05", "name": "Camera 05 - Mumbai Dock A", "code": "CAM-05-HD", "status": "ONLINE"},
        {"id": "CAM-06", "bay_id": "BAY-06", "name": "Camera 06 - Mumbai Dock B", "code": "CAM-06-HD", "status": "ONLINE"}
    ]
    for c in cams_data:
        cam = db.query(models.Camera).filter(models.Camera.id == c["id"]).first()
        if not cam:
            db.add(models.Camera(
                id=c["id"],
                loading_bay_id=c["bay_id"],
                name=c["name"],
                camera_code=c["code"],
                source_type="LIVE_STREAM",
                stream_url=f"rtsp://stream.wms-intel.io/{c['id'].lower()}",
                status=c["status"],
                last_seen_at=datetime.datetime.utcnow()
            ))
    db.commit()

    # 5. Seed Safety Rules
    rules_data = [
        {
            "id": "RULE-001",
            "name": "Freedrop Height Detection",
            "description": "Triggers alert if carton drop height exceeds 0.8m with ground impact profile.",
            "behaviour_type": "Product Dropped",
            "risk_level": "Critical",
            "config": {"height_threshold_m": 0.8, "min_confidence": 0.85}
        },
        {
            "id": "RULE-002",
            "name": "Forceful Dragging Violation",
            "description": "Detects friction abrasion dragging without dolly or mechanical assistance.",
            "behaviour_type": "Product Dragged",
            "risk_level": "Medium",
            "config": {"duration_seconds_threshold": 2.5, "min_confidence": 0.80}
        },
        {
            "id": "RULE-003",
            "name": "Heavy-on-Fragile Stacking",
            "description": "Alerts when heavy cargo (>15kg) is stacked on fragile items.",
            "behaviour_type": "Improper Stacking",
            "risk_level": "High",
            "config": {"max_overhang_percent": 25, "weight_ratio_limit": 1.5}
        },
        {
            "id": "RULE-004",
            "name": "Conveyor Velocity Spike",
            "description": "Flags sudden horizontal throwing/acceleration across roller belts.",
            "behaviour_type": "Rough Handling",
            "risk_level": "High",
            "config": {"max_accel_m_s2": 4.0, "min_confidence": 0.82}
        }
    ]
    for r in rules_data:
        rule = db.query(models.SafetyRule).filter(models.SafetyRule.id == r["id"]).first()
        if not rule:
            db.add(models.SafetyRule(
                id=r["id"],
                facility_id=DEFAULT_FACILITY_ID,
                name=r["name"],
                description=r["description"],
                behaviour_type=r["behaviour_type"],
                threshold_config_json=json.dumps(r["config"]),
                risk_level=r["risk_level"],
                enabled=True,
                created_at=datetime.datetime.utcnow()
            ))
    db.commit()

    # 6. Seed Shifts
    shifts = [
        {"id": "SHIFT-01", "name": "Morning Shift", "start_time": "06:00", "end_time": "14:00"},
        {"id": "SHIFT-02", "name": "Evening Shift", "start_time": "14:00", "end_time": "22:00"}
    ]
    for s in shifts:
        sh = db.query(models.Shift).filter(models.Shift.id == s["id"]).first()
        if not sh:
            db.add(models.Shift(
                id=s["id"],
                facility_id=DEFAULT_FACILITY_ID,
                name=s["name"],
                start_time=s["start_time"],
                end_time=s["end_time"],
                timezone="Asia/Kolkata",
                active=True
            ))
    db.commit()

    # 7. Seed Default User Accounts
    default_users = [
        {
            "id": "user-admin-01",
            "email": "admin@wms-intel.io",
            "password": "password123",
            "full_name": "System Administrator",
            "role": "ADMIN",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID
        },
        {
            "id": "user-sup-01",
            "email": "supervisor@wms-intel.io",
            "password": "password123",
            "full_name": "Dock Supervisor",
            "role": "SUPERVISOR",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID
        },
        {
            "id": "user-op-01",
            "email": "operator@wms-intel.io",
            "password": "password123",
            "full_name": "Bay Operator",
            "role": "OPERATOR",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID
        }
    ]

    for u_data in default_users:
        user = db.query(models.User).filter(models.User.email == u_data["email"]).first()
        hashed = security.get_password_hash(u_data["password"])
        if not user:
            new_user = models.User(
                id=u_data["id"],
                organization_id=u_data["org_id"],
                email=u_data["email"],
                hashed_password=hashed,
                full_name=u_data["full_name"],
                role=u_data["role"],
                facility_id=u_data["facility_id"],
                created_at=datetime.datetime.utcnow()
            )
            db.add(new_user)
            print(f"[Seed] Created user: {u_data['email']} ({u_data['role']})")
        else:
            user.hashed_password = hashed
            user.organization_id = u_data["org_id"]
            user.facility_id = u_data["facility_id"]
            user.role = u_data["role"]
            print(f"[Seed] Updated user credentials: {u_data['email']}")
    db.commit()

    # 8. Seed Default Videos & Video Processing Jobs
    canonical_warehouse_videos = [
        ("VID-C5FF90E4", "Dock level, dragging cupboard.mp4", "CAM-01"),
        ("VID-971E1691", "KD packets dragged, heavy box kept on other packets.mp4", "CAM-02"),
        ("VID-38A329BB", "Rolling and dragging on wet floor.mp4", "CAM-03"),
        ("VID-7E336847", "Rolling and dropping carton.mp4", "CAM-01"),
        ("VID-9FACCC73", "Stepping on cartons, vertical product kept horizontally, heavy product kept on top.mp4", "CAM-04"),
        ("VID-FAD3608B", "Throwing Mattresses.mp4", "CAM-02"),
        ("VID-00949929", "Throwing seating cartons, using strap to hold.mp4", "CAM-01"),
    ]
    videos_data = [
        {
            "video_id": vid,
            "camera_id": cam,
            "filename": fname,
            "duration": 60.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "status": "COMPLETED"
        }
        for vid, fname, cam in canonical_warehouse_videos
    ]
    for v in videos_data:
        vid = db.query(models.Video).filter(models.Video.video_id == v["video_id"]).first()
        if not vid:
            db.add(models.Video(
                video_id=v["video_id"],
                camera_id=v["camera_id"],
                filename=v["filename"],
                duration=v["duration"],
                fps=v["fps"],
                width=v["width"],
                height=v["height"],
                status=v["status"],
                created_at=datetime.datetime.utcnow()
            ))
    db.commit()

    # 9. Seed Realistic Events & Risk Assessments
    # Automatic synthetic event seeding disabled in favor of canonical Member 2 pipeline
    events_seed = []

    for ev in events_seed:
        existing_ev = db.query(models.Event).filter(models.Event.event_id == ev["event_id"]).first()
        if not existing_ev:
            new_ev = models.Event(
                event_id=ev["event_id"],
                organization_id=ev["org_id"],
                facility_id=ev["facility_id"],
                video_id=ev["video_id"],
                timestamp=ev["timestamp"],
                camera_id=ev["camera_id"],
                bay_id=ev["bay_id"],
                object_id=ev["object_id"],
                behaviour=ev["behaviour"],
                risk_score=ev["risk_score"],
                risk_level=ev["risk_level"],
                description=ev["description"],
                reason=ev["reason"],
                evidence_frame=ev["evidence_frame"],
                video_reference=ev["video_reference"],
                recommended_action=ev["recommended_action"],
                status=ev["status"],
                acknowledged_by_user_id=ev.get("acknowledged_by"),
                provenance_type="DEMO_FIXTURE",
                is_demo_data=True,
                is_test_data=False,
                environment="DEVELOPMENT",
                inference_run_id=None,
                created_at=datetime.datetime.utcnow()
            )
            db.add(new_ev)
            db.commit()

            # Seed associated RiskAssessment
            ra_id = f"RA-{ev['event_id']}"
            if not db.query(models.RiskAssessment).filter(models.RiskAssessment.id == ra_id).first():
                factors = [
                    "vertical_acceleration_exceeded",
                    "ground_impact_profile",
                    "repeat_behavior_penalty"
                ]
                db.add(models.RiskAssessment(
                    id=ra_id,
                    event_id=ev["event_id"],
                    risk_level=ev["risk_level"],
                    risk_score=ev["risk_score"],
                    confidence=0.94,
                    reason=ev["reason"],
                    risk_factors_json=json.dumps(factors),
                    model_version="warehouse-risk-v1.4",
                    created_at=datetime.datetime.utcnow()
                ))
                db.commit()

    # 10. Seed Model Runs Telemetry
    if not db.query(models.ModelRun).first():
        db.add(models.ModelRun(
            id="RUN-001",
            model_name="YOLO11s (Warehouse Vision)",
            model_version="v1.4.2-tensorrt",
            device="cuda",
            fps=89.4,
            latency_ms=11.2,
            confidence_threshold=0.45,
            started_at=datetime.datetime.utcnow(),
            status="RUNNING"
        ))
        db.commit()

    # 11. Seed Audit Logs
    if not db.query(models.AuditLog).first():
        db.add(models.AuditLog(
            id="AUD-001",
            organization_id=DEFAULT_ORG_ID,
            user_id="user-admin-01",
            action="SYSTEM_INITIALIZED",
            entity_type="FACILITY",
            entity_id=DEFAULT_FACILITY_ID,
            metadata_json=json.dumps({"seeded_bays": 6, "seeded_cameras": 6}),
            created_at=datetime.datetime.utcnow()
        ))
        db.commit()

    # 12. Seed Authentic Evaluation Dataset & Ground Truth Samples
    dataset = db.query(models.EvaluationDataset).filter(models.EvaluationDataset.id == "DS-ALPHA-V3").first()
    if not dataset:
        dataset = models.EvaluationDataset(
            id="DS-ALPHA-V3",
            name="Warehouse_Dock_Alpha_v3",
            version="v3.1",
            behaviour_class="All_Behaviours",
            sample_count=20,
            description="Annotated production validation dataset covering Product Dropped, Product Dragged, Improper Stacking, and Rough Handling.",
            created_at=datetime.datetime.utcnow()
        )
        db.add(dataset)
        db.commit()

        # Seed 20 evaluation samples (17 TP, 3 FP)
        samples_data = [
            ("SMP-001", "Product Dropped", "Product Dropped", 0.94, True),
            ("SMP-002", "Product Dropped", "Product Dropped", 0.91, True),
            ("SMP-003", "Product Dragged", "Product Dragged", 0.88, True),
            ("SMP-004", "Product Dragged", "Product Dragged", 0.86, True),
            ("SMP-005", "Improper Stacking", "Improper Stacking", 0.92, True),
            ("SMP-006", "Improper Stacking", "Improper Stacking", 0.89, True),
            ("SMP-007", "Rough Handling", "Rough Handling", 0.85, True),
            ("SMP-008", "Rough Handling", "Rough Handling", 0.87, True),
            ("SMP-009", "Product Dropped", "Product Dropped", 0.95, True),
            ("SMP-010", "Product Dragged", "Product Dragged", 0.83, True),
            ("SMP-011", "Improper Stacking", "Improper Stacking", 0.90, True),
            ("SMP-012", "Rough Handling", "Rough Handling", 0.82, True),
            ("SMP-013", "Nominal", "Product Dragged", 0.62, False), # FP
            ("SMP-014", "Product Dropped", "Product Dropped", 0.93, True),
            ("SMP-015", "Product Dragged", "Product Dragged", 0.89, True),
            ("SMP-016", "Nominal", "Rough Handling", 0.58, False), # FP
            ("SMP-017", "Improper Stacking", "Improper Stacking", 0.91, True),
            ("SMP-018", "Product Dropped", "Product Dropped", 0.96, True),
            ("SMP-019", "Nominal", "Product Dropped", 0.55, False), # FP
            ("SMP-020", "Rough Handling", "Rough Handling", 0.88, True),
        ]
        for s_id, gt, pred, conf, corr in samples_data:
            db.add(models.EvaluationSample(
                id=s_id,
                dataset_id="DS-ALPHA-V3",
                video_id="VID-7E336847",
                frame_number=100 + int(s_id.split("-")[1]) * 10,
                timestamp=10.0 + int(s_id.split("-")[1]),
                ground_truth_label=gt,
                predicted_label=pred,
                confidence=conf,
                is_correct=corr,
                created_at=datetime.datetime.utcnow()
            ))
        db.commit()
        print("[Seed] Created EvaluationDataset 'DS-ALPHA-V3' with 20 ground-truth samples.")

    print("[Seed] Seed initialization complete.")


if __name__ == "__main__":
    from app.db.database import SessionLocal, engine, Base
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    init_db(db)
    db.close()

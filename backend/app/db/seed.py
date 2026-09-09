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
        if bind.dialect.name != 'sqlite':
            return
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
    videos_data = [
        {
            "video_id": "vid-cam01-20231027",
            "camera_id": "CAM-01",
            "filename": "Rolling and dropping carton.mp4",
            "duration": 60.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "status": "COMPLETED"
        },
        {
            "video_id": "vid-cam02-20231027",
            "camera_id": "CAM-02",
            "filename": "loading_bay2_shift1.mp4",
            "duration": 120.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "status": "COMPLETED"
        },
        {
            "video_id": "vid-cam03-20231028",
            "camera_id": "CAM-03",
            "filename": "aisle_staging_bay1.mp4",
            "duration": 90.0,
            "fps": 30.0,
            "width": 1920,
            "height": 1080,
            "status": "COMPLETED"
        }
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
    events_seed = [
        {
            "event_id": "EVT-014",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID,
            "video_id": "vid-cam01-20231027",
            "timestamp": 12.5,
            "camera_id": "CAM-01",
            "bay_id": "Loading Bay 01",
            "object_id": 104,
            "behaviour": "Product Dropped",
            "risk_score": 92.5,
            "risk_level": "Critical",
            "description": "Heavy electronic carton dropped from 1.5m height during manual transfer.",
            "reason": "Rapid downward displacement (>1.4m/s) followed by high deceleration ground impact.",
            "evidence_frame": "/videos/Rolling%20and%20dropping%20carton.mp4#t=12.5",
            "video_reference": "/videos/Rolling%20and%20dropping%20carton.mp4#t=12.5",
            "recommended_action": "Quarantine carton #104, inspect internal fragile components, and re-train operator.",
            "status": "UNRESOLVED"
        },
        {
            "event_id": "EVT-015",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID,
            "video_id": "vid-cam01-20231027",
            "timestamp": 24.8,
            "camera_id": "CAM-01",
            "bay_id": "Loading Bay 01",
            "object_id": 208,
            "behaviour": "Product Dragged",
            "risk_score": 68.0,
            "risk_level": "High",
            "description": "Heavy corrugated carton dragged across concrete floor without hand truck.",
            "reason": "Sustained low-height friction translation over 4.2 seconds violating ergonomic safety rules.",
            "evidence_frame": "/videos/Rolling%20and%20dropping%20carton.mp4#t=24.8",
            "video_reference": "/videos/Rolling%20and%20dropping%20carton.mp4#t=24.8",
            "recommended_action": "Provide hydraulic dolly and enforce two-person lift for packages > 20kg.",
            "status": "ACKNOWLEDGED",
            "acknowledged_by": "user-sup-01"
        },
        {
            "event_id": "EVT-016",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID,
            "video_id": "vid-cam02-20231027",
            "timestamp": 41.2,
            "camera_id": "CAM-02",
            "bay_id": "Loading Bay 02",
            "object_id": 311,
            "behaviour": "Improper Stacking",
            "risk_score": 76.4,
            "risk_level": "High",
            "description": "Heavy wooden crate placed on top of lightweight fragile consumer goods tier.",
            "reason": "Stack weight ratio inverted (heavy item over overhang threshold > 30%).",
            "evidence_frame": "/videos/loading_bay2_shift1.mp4#t=41.2",
            "video_reference": "/videos/loading_bay2_shift1.mp4#t=41.2",
            "recommended_action": "Restack pallet to maintain heavy items at base level.",
            "status": "UNRESOLVED"
        },
        {
            "event_id": "EVT-017",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID,
            "video_id": "vid-cam02-20231027",
            "timestamp": 55.0,
            "camera_id": "CAM-02",
            "bay_id": "Loading Bay 02",
            "object_id": 402,
            "behaviour": "Rough Handling",
            "risk_score": 45.0,
            "risk_level": "Medium",
            "description": "Carton tossed onto roller conveyor belt with elevated horizontal velocity.",
            "reason": "Horizontal acceleration spike exceeded 3.8 m/s².",
            "evidence_frame": "/videos/loading_bay2_shift1.mp4#t=55.0",
            "video_reference": "/videos/loading_bay2_shift1.mp4#t=55.0",
            "recommended_action": "Remind team of gentle placement on conveyor lines.",
            "status": "DISPATCHED",
            "acknowledged_by": "user-sup-01"
        },
        {
            "event_id": "EVT-018",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": DEFAULT_FACILITY_ID,
            "video_id": "vid-cam03-20231028",
            "timestamp": 18.2,
            "camera_id": "CAM-03",
            "bay_id": "Loading Bay 03",
            "object_id": 512,
            "behaviour": "Unstable Stacking",
            "risk_score": 32.0,
            "risk_level": "Low",
            "description": "Minor stack overhang detected on staging pallet.",
            "reason": "Overhang angle 12 degrees within tolerance limits.",
            "evidence_frame": "/videos/aisle_staging_bay1.mp4#t=18.2",
            "video_reference": "/videos/aisle_staging_bay1.mp4#t=18.2",
            "recommended_action": "Monitor pallet wrap before forklift transport.",
            "status": "RESOLVED"
        },
        {
            "event_id": "EVT-020",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": SECONDARY_FACILITY_ID,
            "video_id": "vid-cam05-20231029",
            "timestamp": 14.2,
            "camera_id": "CAM-05",
            "bay_id": "Loading Bay 05",
            "object_id": 601,
            "behaviour": "Product Dropped",
            "risk_score": 88.5,
            "risk_level": "Critical",
            "description": "Fragile solar panel crate dropped during forklift loading at Mumbai Hub.",
            "reason": "Vertical acceleration spike ay = 10.2 m/s².",
            "evidence_frame": "/videos/Rolling%20and%20dropping%20carton.mp4#t=14.2",
            "video_reference": "/videos/Rolling%20and%20dropping%20carton.mp4#t=14.2",
            "recommended_action": "Halt bay 5 loading, inspect solar panel integrity.",
            "status": "UNRESOLVED"
        },
        {
            "event_id": "EVT-021",
            "org_id": DEFAULT_ORG_ID,
            "facility_id": SECONDARY_FACILITY_ID,
            "video_id": "vid-cam06-20231029",
            "timestamp": 33.1,
            "camera_id": "CAM-06",
            "bay_id": "Loading Bay 06",
            "object_id": 608,
            "behaviour": "Improper Stacking",
            "risk_score": 64.0,
            "risk_level": "High",
            "description": "Heavy machinery part stacked on top of cardboard carton box.",
            "reason": "Inverted mass distribution profile detected by vision model.",
            "evidence_frame": "/videos/loading_bay2_shift1.mp4#t=33.1",
            "video_reference": "/videos/loading_bay2_shift1.mp4#t=33.1",
            "recommended_action": "Restack pallet immediately.",
            "status": "UNRESOLVED"
        }
    ]

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

    # Auto-ingest canonical trajectory files from data/Trajectories
    try:
        from app.engine.behaviour.rule_engine import RuleEngine
        from app.engine.risk.pipeline import score_and_build_events
        from app.services.event_adapter import event_adapter

        traj_dirs = [
            Path.cwd() / "data" / "Trajectories",
            backend_dir / "data" / "Trajectories",
            backend_dir.parent / "data" / "Trajectories"
        ]
        active_traj_dir = None
        for td in traj_dirs:
            if td.exists() and td.is_dir():
                active_traj_dir = td
                break

        if active_traj_dir:
            csv_files = sorted([f for f in active_traj_dir.glob("*.csv") if f.is_file()])
            engine = RuleEngine()
            for c_path in csv_files:
                clean_stem = c_path.stem.replace("_trajectories", "")
                existing_cnt = db.query(models.Event).filter(models.Event.video_id == clean_stem).count()
                if existing_cnt == 0:
                    tracks = engine.parse_trajectory_csv(c_path)
                    candidates = engine.process_tracks(tracks, fps=30.0, video_name=clean_stem)
                    canonical_events = score_and_build_events(candidates, video_id=clean_stem, fps=30.0)
                    event_adapter.adapt_and_persist_events(
                        db=db,
                        root_events=canonical_events,
                        video_name_or_id=clean_stem,
                        fps=30.0,
                        provenance_type="REAL_INFERENCE"
                    )
                    print(f"[Seed] Auto-ingested {len(canonical_events)} trajectory events for: {clean_stem}")
    except Exception as e:
        print(f"[Seed] Trajectory auto-ingest notice: {e}")

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
                video_id="vid-cam01-20231027",
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


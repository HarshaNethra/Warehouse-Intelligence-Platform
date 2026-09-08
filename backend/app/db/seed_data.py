import json
from app.db.database import get_db

SEED_VIDEOS = [
    {
        "video_id": "vid-cam01-20231027",
        "filename": "loading_bay4_shift1.mp4",
        "fps": 30.0,
        "frame_count": 1800,
        "width": 1920,
        "height": 1080,
        "duration": 60.0,
        "status": "processed",
    },
    {
        "video_id": "vid-cam02-20231027",
        "filename": "loading_bay2_shift1.mp4",
        "fps": 30.0,
        "frame_count": 3600,
        "width": 1920,
        "height": 1080,
        "duration": 120.0,
        "status": "processed",
    },
    {
        "video_id": "vid-cam03-20231028",
        "filename": "aisle_staging_bay1.mp4",
        "fps": 30.0,
        "frame_count": 2700,
        "width": 1920,
        "height": 1080,
        "duration": 90.0,
        "status": "processed",
    }
]

SEED_EVENTS = [
    {
        "event_id": "EVT-001",
        "video_id": "vid-cam01-20231027",
        "timestamp": 12.5,
        "camera_id": "CAM-01",
        "bay_id": "Bay 4",
        "object_id": 104,
        "behaviour": "Product Dropped",
        "risk_score": 92.0,
        "risk_level": "Critical",
        "description": "A heavy carton was dropped from a height of approximately 1.5 meters.",
        "reason": "Rapid downward movement detected followed by sudden stop and large impact estimation.",
        "tags": ["critical", "drop", "impact", "fragile"],
        "evidence_frame": "/evidence/evt-001.jpg",
        "video_reference": "vid-cam01-20231027#t=12.5",
        "recommended_action": "Inspect the dropped carton for internal damage and review handling procedures with the operator."
    },
    {
        "event_id": "EVT-002",
        "video_id": "vid-cam01-20231027",
        "timestamp": 24.1,
        "camera_id": "CAM-01",
        "bay_id": "Bay 4",
        "object_id": 211,
        "behaviour": "Rough Handling",
        "risk_score": 65.0,
        "risk_level": "High",
        "description": "Carton was thrown onto the pallet forcefully.",
        "reason": "High velocity horizontal movement ending in abrupt deceleration against another object.",
        "tags": ["handling", "velocity", "throw"],
        "evidence_frame": "/evidence/evt-002.jpg",
        "video_reference": "vid-cam01-20231027#t=24.1",
        "recommended_action": "Remind team of fragile product handling guidelines."
    },
    {
        "event_id": "EVT-003",
        "video_id": "vid-cam01-20231027",
        "timestamp": 45.0,
        "camera_id": "CAM-01",
        "bay_id": "Bay 4",
        "object_id": 305,
        "behaviour": "Product Dragged",
        "risk_score": 40.0,
        "risk_level": "Medium",
        "description": "Carton was dragged across the floor instead of lifted.",
        "reason": "Sustained horizontal movement at floor level for over 3 seconds.",
        "tags": ["drag", "abrasion", "ergonomics"],
        "evidence_frame": "/evidence/evt-003.jpg",
        "video_reference": "vid-cam01-20231027#t=45.0",
        "recommended_action": "Provide lifting equipment or enforce two-person lift for heavy items."
    },
    {
        "event_id": "EVT-004",
        "video_id": "vid-cam02-20231027",
        "timestamp": 55.2,
        "camera_id": "CAM-02",
        "bay_id": "Bay 2",
        "object_id": 402,
        "behaviour": "Unstable Stacking",
        "risk_score": 25.0,
        "risk_level": "Low",
        "description": "Carton placed with significant overhang on pallet stack.",
        "reason": "Bounding box overlap analysis shows > 30% overhang.",
        "tags": ["stacking", "overhang", "stability"],
        "evidence_frame": "/evidence/evt-004.jpg",
        "video_reference": "vid-cam02-20231027#t=55.2",
        "recommended_action": "Monitor stack stability during transport."
    },
    {
        "event_id": "EVT-005",
        "video_id": "vid-cam02-20231027",
        "timestamp": 78.4,
        "camera_id": "CAM-02",
        "bay_id": "Bay 2",
        "object_id": 156,
        "behaviour": "Product Dropped",
        "risk_score": 88.0,
        "risk_level": "Critical",
        "description": "Pallet corner collapsed during pallet-jack unloading, dropping top package.",
        "reason": "Sudden vertical shift > 1.2m with ground collision impact profile.",
        "tags": ["critical", "drop", "pallet", "safety"],
        "evidence_frame": "/evidence/evt-005.jpg",
        "video_reference": "vid-cam02-20231027#t=78.4",
        "recommended_action": "Quarantine damaged goods and inspect pallet integrity before restocking."
    },
    {
        "event_id": "EVT-006",
        "video_id": "vid-cam03-20231028",
        "timestamp": 31.8,
        "camera_id": "CAM-03",
        "bay_id": "Bay 1",
        "object_id": 512,
        "behaviour": "Rough Handling",
        "risk_score": 72.0,
        "risk_level": "High",
        "description": "Unloading team shoved cartons violently across conveyor rollers.",
        "reason": "Acceleration spike exceeds 4.5 m/s² with high deceleration impact.",
        "tags": ["conveyor", "rough_handling", "acceleration"],
        "evidence_frame": "/evidence/evt-006.jpg",
        "video_reference": "vid-cam03-20231028#t=31.8",
        "recommended_action": "Adjust conveyor speed and conduct ergonomic training."
    },
    {
        "event_id": "EVT-007",
        "video_id": "vid-cam03-20231028",
        "timestamp": 62.0,
        "camera_id": "CAM-03",
        "bay_id": "Bay 1",
        "object_id": 619,
        "behaviour": "Unstable Stacking",
        "risk_score": 58.0,
        "risk_level": "Medium",
        "description": "Column stack exceeds maximum permitted height limit of 1.8m.",
        "reason": "Vertical bounding box height ratio relative to pallet base exceeds safe threshold.",
        "tags": ["height_limit", "unstable", "stacking"],
        "evidence_frame": "/evidence/evt-007.jpg",
        "video_reference": "vid-cam03-20231028#t=62.0",
        "recommended_action": "Restack pallet to maximum 4 tiers height."
    },
    {
        "event_id": "EVT-008",
        "video_id": "vid-cam01-20231027",
        "timestamp": 51.5,
        "camera_id": "CAM-01",
        "bay_id": "Bay 4",
        "object_id": 118,
        "behaviour": "Product Dragged",
        "risk_score": 45.0,
        "risk_level": "Medium",
        "description": "Heavy wooden crate pulled along dock ramp without dolly.",
        "reason": "Low elevation linear translation along ramp surface over 4.2 seconds.",
        "tags": ["ramp", "drag", "equipment_missing"],
        "evidence_frame": "/evidence/evt-008.jpg",
        "video_reference": "vid-cam01-20231027#t=51.5",
        "recommended_action": "Mandate hand truck usage on all ramp transfer routes."
    }
]

def seed_database_if_empty() -> None:
    """Seed initial videos and events if the database is currently empty."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM videos")
        video_count = cursor.fetchone()[0]
        
        if video_count == 0:
            for video in SEED_VIDEOS:
                cursor.execute("""
                    INSERT INTO videos (video_id, filename, fps, frame_count, width, height, duration, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    video["video_id"],
                    video["filename"],
                    video["fps"],
                    video["frame_count"],
                    video["width"],
                    video["height"],
                    video["duration"],
                    video["status"]
                ))

        cursor.execute("SELECT COUNT(*) FROM events")
        event_count = cursor.fetchone()[0]
        if event_count == 0:
            for event in SEED_EVENTS:
                cursor.execute("""
                    INSERT INTO events (
                        event_id, video_id, timestamp, camera_id, bay_id, object_id,
                        behaviour, risk_score, risk_level, description, reason,
                        tags, evidence_frame, video_reference, recommended_action
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    event["event_id"],
                    event["video_id"],
                    event["timestamp"],
                    event["camera_id"],
                    event["bay_id"],
                    event["object_id"],
                    event["behaviour"],
                    event["risk_score"],
                    event["risk_level"],
                    event["description"],
                    event["reason"],
                    json.dumps(event["tags"]),
                    event["evidence_frame"],
                    event["video_reference"],
                    event["recommended_action"]
                ))
        conn.commit()

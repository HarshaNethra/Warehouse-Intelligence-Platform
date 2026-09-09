import uuid
import random
import time
from app.db.database import SessionLocal, engine, Base
from app.db.models import Video, Event

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing
    db.query(Event).delete()
    db.query(Video).delete()
    db.commit()

    # Create dummy videos
    video_1 = Video(
        video_id=str(uuid.uuid4()),
        filename="unloading_bay_1.mp4",
        frame_count=1800,
        fps=30.0,
        width=1920,
        height=1080,
        duration=60.0,
        status="processed"
    )
    db.add(video_1)

    # Create dummy events
    behaviours = ["Product dropped", "Product thrown", "Improper stacking", "Rough handling"]
    risk_levels = ["Low", "Medium", "High", "Critical"]
    
    now = time.time()
    
    for i in range(20):
        risk_score = random.uniform(10, 100)
        risk_level = "Critical" if risk_score > 90 else "High" if risk_score > 70 else "Medium" if risk_score > 40 else "Low"
        
        event = Event(
            event_id=f"EVT-{i:03d}",
            video_id=video_1.video_id,
            timestamp=now - random.randint(100, 10000),
            camera_id=f"CAM-{random.randint(1, 5)}",
            bay_id=f"BAY-{random.randint(1, 3)}",
            behaviour=random.choice(behaviours),
            risk_score=risk_score,
            risk_level=risk_level,
            description=f"Automated detection of {risk_level.lower()} risk behaviour.",
            reason="Detected via temporal rules engine.",
            recommended_action="Review footage and brief operator."
        )
        db.add(event)

    db.commit()
    db.close()
    print("Database seeded successfully with mock videos and events.")

if __name__ == "__main__":
    seed()

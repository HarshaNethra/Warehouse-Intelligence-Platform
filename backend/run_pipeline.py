import os
import sys
import json
import time

# Ensure backend root directory is on PYTHONPATH
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import Base, engine, SessionLocal
from app.services.inference import MultiModelInferencePipeline
from app.db.models import Video

def run_standalone_pipeline():
    print("=" * 65)
    print("      AI WAREHOUSE INTELLIGENCE PLATFORM - INFERENCE PIPELINE     ")
    print("=" * 65)

    # Initialize Database Tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Register or retrieve test video record
        video_id = "VID-PILOT-BAY1"
        existing = db.query(Video).filter(Video.video_id == video_id).first()
        if not existing:
            v_record = Video(
                video_id=video_id,
                filename="Rolling and dropping carton.mp4",
                frame_count=600,
                fps=30.0,
                width=1920,
                height=1080,
                duration=20.0,
                status="processing"
            )
            db.add(v_record)
            db.commit()

        # Instantiate Multi-Model Inference Pipeline
        pipeline = MultiModelInferencePipeline(device="cpu", fps=30.0)

        print("\n[Pipeline Execution] Running Frame-by-Frame Inference & Rule Evaluation...")
        
        telemetry_stream = []
        fps = 30.0
        total_frames = 60 # Run 2-second clip evaluation (60 frames)

        for frame_idx in range(total_frames):
            timestamp_sec = round(frame_idx / fps, 2)
            
            # Process frame through detection, pose, kinematics, and DB logging
            payload = pipeline.process_frame(
                frame_np=None, # Synthetic execution mode
                frame_index=frame_idx,
                timestamp_sec=timestamp_sec,
                video_id=video_id,
                session_id="SESSION-PILOT-01",
                db_session=db
            )

            telemetry_stream.append(payload)

            if frame_idx % 15 == 0:
                print(f"  Frame {frame_idx:03d} | t={timestamp_sec:04.1f}s | Risk: {payload['risk_score']}% | Status: {payload['status']} | Latency: {payload['inference_latency_ms']}ms")

        # Output sample structured telemetry JSON payload
        print("\n[Pipeline Output] Sample Frame Telemetry JSON Payload:")
        print(json.dumps(telemetry_stream[15], indent=2))

        print(f"\n[Pipeline Summary] Completed processing {len(telemetry_stream)} frames.")
        print(f"[Database Log] Telemetry points logged to database for Video ID: {video_id}")
        print("=" * 65)

    finally:
        db.close()

if __name__ == "__main__":
    run_standalone_pipeline()

#!/usr/bin/env python3
"""
GEG AI Video Intelligence Platform - Frame-by-Frame Kinematic & Temporal Risk Pipeline

Mathematical Formulation:
1. Frame Kinematics & Spatial Risk Function R(t):
   - Vertical Velocity: v_y(t) = (y_t - y_{t-1}) / dt
   - Vertical Acceleration: a_y(t) = (v_y(t) - v_y(t-1)) / dt
   - Horizontal Drag Velocity: v_x(t) = |x_t - x_{t-1}| / dt
   - R(t) = min(100, W_drop * a_y(t) + W_drag * v_x(t) + W_stack * S_r)

2. Video Temporal Score Accumulation:
   - R_video = alpha * max_{t in [1, N]} R(t) + (1 - alpha) * (1 / |K| * sum_{k in K} R(k))
   - alpha = 0.7 (70% Peak Risk + 30% Mean Risky Duration Score)
"""

import os
import sys
import csv
import json
import numpy as np
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
PROJECT_ROOT = backend_dir.parent.parent
TRAJECTORIES_DIR = PROJECT_ROOT / "Godrej" / "data" / "Trajectories"
OUTPUT_DIR = backend_dir / "test_outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

def process_kinematic_trajectory(csv_path: Path):
    rows = []
    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows.append({
                "frame": int(r["frame"]),
                "object_id": int(r["object_id"]),
                "class": r["class"],
                "x": float(r["x"]),
                "y": float(r["y"]),
                "w": float(r["width"]),
                "h": float(r["height"]),
            })

    if not rows:
        return None

    video_name = csv_path.stem.replace("_trajectories", "")
    fps = 30.0
    dt = 1.0 / fps

    # Group tracks by object_id
    track_history = {}
    frame_dict = {}

    for r in rows:
        fid = r["frame"]
        oid = r["object_id"]
        if fid not in frame_dict:
            frame_dict[fid] = []
        frame_dict[fid].append(r)

        if oid not in track_history:
            track_history[oid] = []
        track_history[oid].append((r["x"], r["y"], fid, r["class"]))

    max_frame = max(frame_dict.keys())
    frame_scores = []
    detected_events = []

    for f_idx in range(max_frame + 1):
        timestamp = f_idx * dt
        current_frame_risk = 0.0
        active_behaviors = []

        if f_idx in frame_dict:
            for obj in frame_dict[f_idx]:
                oid = obj["object_id"]
                history = track_history[oid]
                history_before = [h for h in history if h[2] <= f_idx]

                if len(history_before) >= 3:
                    x, y = history_before[-1][0], history_before[-1][1]
                    x_prev, y_prev = history_before[-2][0], history_before[-2][1]
                    x_prev2, y_prev2 = history_before[-3][0], history_before[-3][1]

                    # Velocity vectors
                    vy = (y - y_prev) / dt
                    vy_prev = (y_prev - y_prev2) / dt
                    vx = abs(x - x_prev) / dt

                    # Acceleration vector
                    ay = (vy - vy_prev) / dt

                    # Rule 1: Vertical Freefall Drop & Impact Spike
                    if ay < -300 or vy > 250:
                        drop_risk = min(100.0, abs(ay) / 8.0)
                        current_frame_risk = max(current_frame_risk, drop_risk)
                        active_behaviors.append("Product Dropped / Impact")

                        detected_events.append({
                            "event_id": f"EVT-FRAME-{f_idx}",
                            "timestamp_sec": round(timestamp, 2),
                            "behavior": "Product Dropped",
                            "confidence": 0.93,
                            "frame_risk": round(drop_risk, 1)
                        })

                    # Rule 2: Horizontal Dragging on Floor
                    if vx > 80 and y > 500:
                        drag_risk = 68.5
                        current_frame_risk = max(current_frame_risk, drag_risk)
                        active_behaviors.append("Product Dragged on Floor")

                    # Rule 3: Heavy Item Kept on Fragile Packets / Throwing Impulse
                    if ay > 450:
                        stack_risk = 85.0
                        current_frame_risk = max(current_frame_risk, stack_risk)
                        active_behaviors.append("Improper Stacking / Throwing Impulse")

        frame_scores.append({
            "frame": f_idx,
            "timestamp": round(timestamp, 2),
            "risk_score": round(current_frame_risk, 1),
            "behaviors": list(set(active_behaviors))
        })

    # Temporal Risk Accumulation Formula:
    # R_video = alpha * max(R_t) + (1 - alpha) * mean(R_k for R_k > 20.0)
    alpha = 0.7
    all_risks = [f["risk_score"] for f in frame_scores]
    peak_risk = max(all_risks) if all_risks else 0.0
    risky_frames = [r for r in all_risks if r > 20.0]
    avg_risky_score = float(np.mean(risky_frames)) if risky_frames else 0.0

    composite_video_score = round((alpha * peak_risk) + ((1.0 - alpha) * avg_risky_score), 1)

    risk_level = "Low"
    if composite_video_score > 80.0:
        risk_level = "Critical"
    elif composite_video_score > 60.0:
        risk_level = "High"
    elif composite_video_score > 35.0:
        risk_level = "Medium"

    telemetry_output = {
        "video_name": video_name,
        "total_frames": max_frame + 1,
        "duration_sec": round((max_frame + 1) * dt, 2),
        "peak_risk": round(peak_risk, 1),
        "avg_risky_score": round(avg_risky_score, 1),
        "composite_risk_score": composite_video_score,
        "risk_level": risk_level,
        "unique_events_detected": len(detected_events),
        "events": detected_events[:10],
        "frame_telemetry": frame_scores[::5]  # Subsample every 5th frame for UI chart rendering
    }

    return telemetry_output

def run_pipeline():
    print("=" * 75)
    print("FRAME-BY-FRAME KINEMATIC & TEMPORAL RISK ACCUMULATION PIPELINE")
    print("=" * 75)

    csv_files = sorted(list(TRAJECTORIES_DIR.glob("*.csv")))
    all_video_results = {}

    for csv_file in csv_files:
        result = process_kinematic_trajectory(csv_file)
        if result:
            all_video_results[result["video_name"]] = result
            print(f"📹 Video: {result['video_name']:<55} | Score: {result['composite_risk_score']:<5.1f} | Risk: {result['risk_level']}")

    out_file = OUTPUT_DIR / "telemetry_results.json"
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(all_video_results, f, indent=2)

    print("-" * 75)
    print(f"✅ Generated telemetry results for all video streams: {out_file}\n")

if __name__ == "__main__":
    run_pipeline()

"""
Trajectory Export Pipeline using Trained YOLO model (models/best.pt) and ByteTrack.

Processes CCTV video footage, extracts multi-object tracks, produces standardized
trajectory CSVs, metadata JSON files, and performs automated data-quality validation.
"""

import argparse
import csv
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import torch
from ultralytics import YOLO

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def inspect_model_weights(model_path: Path) -> Tuple[YOLO, Dict[int, str]]:
    """Loads and inspects the trained model weights, reporting classes."""
    if not model_path.exists():
        raise FileNotFoundError(f"Trained model weights not found at: {model_path}")

    print("=" * 70)
    print("YOLO MODEL WEIGHTS INSPECTION")
    print("=" * 70)
    print(f"Model Path: {model_path}")
    model = YOLO(str(model_path))
    class_names = model.names
    print(f"Trained Classes Count: {len(class_names)}")
    print("Recognized Classes:")
    for cls_id, cls_name in class_names.items():
        print(f"  [{cls_id}] {cls_name}")
    print("-" * 70)
    return model, class_names


def validate_trajectory_data(rows: List[Dict[str, Any]], frame_w: int, frame_h: int) -> List[str]:
    """
    Performs automated data quality checks on extracted trajectory rows:
    - Required columns
    - Null / NaN values
    - Valid bounds & positive dimensions
    - Obvious large coordinate jumps (> 400px between consecutive observations)
    """
    warnings: List[str] = []
    if not rows:
        warnings.append("WARNING: Trajectory dataset is empty (0 detections).")
        return warnings

    # Group by object_id to check trajectory continuity and velocity jumps
    obj_tracks = defaultdict(list)

    for idx, r in enumerate(rows):
        f = r["frame"]
        obj_id = r["object_id"]
        x, y, w, h = r["x"], r["y"], r["width"], r["height"]

        if any(math.isnan(v) or math.isinf(v) for v in (x, y, w, h)):
            warnings.append(f"WARNING: Row {idx} (obj {obj_id}, frame {f}) contains NaN/Inf coordinates.")

        if w <= 0 or h <= 0:
            warnings.append(f"WARNING: Row {idx} (obj {obj_id}, frame {f}) has non-positive dimensions ({w}x{h}).")

        # Bounds sanity check (allow boxes extending slightly off-screen up to 100px)
        if x < -100 or x > (frame_w + 100) or y < -100 or y > (frame_h + 100):
            warnings.append(f"WARNING: Row {idx} (obj {obj_id}, frame {f}) center ({x}, {y}) is outside reasonable screen bounds.")

        obj_tracks[obj_id].append((f, x, y))

    # Check for trajectory jumps (> 400px displacement between consecutive tracked frames)
    for obj_id, pts in obj_tracks.items():
        pts.sort(key=lambda item: item[0])
        for i in range(1, len(pts)):
            prev_f, prev_x, prev_y = pts[i - 1]
            curr_f, curr_x, curr_y = pts[i]

            # If consecutive or closely spaced frames (<= 3 frames apart)
            if (curr_f - prev_f) <= 3:
                jump_dist = math.hypot(curr_x - prev_x, curr_y - prev_y)
                if jump_dist >= 400.0:
                    warnings.append(
                        f"WARNING: Object {obj_id} jumps {jump_dist:.1f} pixels between frame {prev_f} and {curr_f}."
                    )

    return warnings


def print_track_quality_summary(video_stem: str,
                                fps: float,
                                width: int,
                                height: int,
                                total_frames: int,
                                rows: List[Dict[str, Any]],
                                warnings: List[str]) -> None:
    """Prints a detailed track quality breakdown for the processed video."""
    print("\n" + "-" * 70)
    print(f"TRACK QUALITY SUMMARY: {video_stem}")
    print("-" * 70)
    print(f"FPS:              {fps:.2f}")
    print(f"Resolution:       {width}x{height}")
    print(f"Total Frames:     {total_frames}")
    print(f"Trajectory rows:  {len(rows)}")

    unique_objects = len(set(r["object_id"] for r in rows))
    classes_detected = sorted(list(set(r["class"] for r in rows)))
    print(f"Unique object IDs:{unique_objects}")
    print(f"Classes detected: {classes_detected}")

    # Per-class summary
    class_rows = Counter(r["class"] for r in rows)
    class_objects = defaultdict(set)
    for r in rows:
        class_objects[r["class"]].add(r["object_id"])

    print("\nClass Breakdown:")
    print(f"  {'Class Name':<15} | {'Detection Rows':<15} | {'Unique IDs':<12}")
    print(f"  {'-'*15}-+-{'-'*15}-+-{'-'*12}")
    for cls_name in classes_detected:
        print(f"  {cls_name:<15} | {class_rows[cls_name]:<15} | {len(class_objects[cls_name]):<12}")

    # Per-object track span summary
    obj_info = defaultdict(lambda: {"class": "", "frames": []})
    for r in rows:
        oid = r["object_id"]
        obj_info[oid]["class"] = r["class"]
        obj_info[oid]["frames"].append(r["frame"])

    print(f"\nObject Tracks Summary (Total {len(obj_info)} tracks):")
    print(f"  {'Object ID':<10} | {'Class':<12} | {'First Frame':<12} | {'Last Frame':<12} | {'Frames Tracked':<14}")
    print(f"  {'-'*10}-+-{'-'*12}-+-{'-'*12}-+-{'-'*12}-+-{'-'*14}")

    # Show first 15 objects or all if <= 20
    sorted_oids = sorted(obj_info.keys())
    sample_oids = sorted_oids if len(sorted_oids) <= 20 else sorted_oids[:15]
    for oid in sample_oids:
        frames = sorted(obj_info[oid]["frames"])
        c_name = obj_info[oid]["class"]
        print(f"  {oid:<10} | {c_name:<12} | {frames[0]:<12} | {frames[-1]:<12} | {len(frames):<14}")
    if len(sorted_oids) > 20:
        print(f"  ... [{len(sorted_oids) - 15} additional tracks omitted for brevity]")

    if warnings:
        print(f"\nQuality Warnings ({len(warnings)}):")
        for w in warnings[:5]:
            print(f"  [!] {w}")
        if len(warnings) > 5:
            print(f"  [!] ... and {len(warnings) - 5} more warnings.")
    else:
        print("\nQuality Warnings: None (Clean trajectory continuity)")
    print("-" * 70)


def process_single_video(video_path: Path,
                         model: YOLO,
                         output_dir: Path,
                         metadata_dir: Path,
                         derived_dir: Optional[Path] = None,
                         conf: float = 0.25,
                         device: str = "0",
                         overwrite: bool = False) -> Tuple[Path, Path, Dict[str, Any], List[str]]:
    """
    Executes detection and ByteTrack tracking for a single video file,
    saving trajectory CSV and metadata JSON.
    """
    vid_name = video_path.stem
    csv_path = output_dir / f"{vid_name}_trajectories.csv"
    meta_path = metadata_dir / f"{vid_name}_metadata.json"

    if csv_path.exists() and not overwrite:
        print(f"\n[SKIP] Trajectory CSV already exists for: {vid_name}")
        print(f"       Path: {csv_path}")
        print("       Use --overwrite to re-process and replace.")
        # Load existing metadata if available
        meta = {}
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                meta = json.load(f)
        return csv_path, meta_path, meta, []

    # 1. Read Video Properties
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Unable to open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_seconds = round(total_frames / fps, 2) if fps > 0 else 0.0
    cap.release()

    print(f"\nProcessing Video: {video_path.name}")
    print(f"Resolution: {width}x{height} | FPS: {fps:.2f} | Total Frames: {total_frames} | Duration: {duration_seconds}s")
    print(f"Inference Device: {device} | Confidence: {conf} | Tracker: bytetrack.yaml")

    # 2. Run Object Detection and ByteTrack Tracking (streaming mode)
    results = model.track(
        source=str(video_path),
        persist=True,
        conf=conf,
        tracker="bytetrack.yaml",
        stream=True,
        device=device,
        verbose=False,
    )

    rows: List[Dict[str, Any]] = []
    derived_rows: List[Dict[str, Any]] = []

    for frame_idx, r in enumerate(results):
        if r.boxes is None or r.boxes.id is None:
            continue

        boxes = r.boxes.xywh.cpu().numpy()
        track_ids = r.boxes.id.cpu().numpy()
        classes = r.boxes.cls.cpu().numpy()

        for box, obj_id, cls in zip(boxes, track_ids, classes):
            x, y, w, h = box
            cls_name = model.names[int(cls)]

            # Raw standard trajectory row
            row = {
                "frame": frame_idx,
                "object_id": int(obj_id),
                "class": cls_name,
                "x": round(float(x), 2),
                "y": round(float(y), 2),
                "width": round(float(w), 2),
                "height": round(float(h), 2),
            }
            rows.append(row)

            # Optional derived row
            if derived_dir:
                derived_rows.append({
                    **row,
                    "center_x": round(float(x), 2),
                    "center_y": round(float(y), 2),
                    "area": round(float(w * h), 2),
                })

        if frame_idx % 200 == 0 and frame_idx > 0:
            print(f"  Frame {frame_idx}/{total_frames} processed... ({len(rows)} detections so far)")

    # 3. Data Quality Validation
    warnings = validate_trajectory_data(rows, width, height)

    # 4. Save Raw Trajectory CSV
    output_dir.mkdir(parents=True, exist_ok=True)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["frame", "object_id", "class", "x", "y", "width", "height"])
        writer.writeheader()
        writer.writerows(rows)

    # 5. Save Derived CSV if requested
    if derived_dir and derived_rows:
        derived_dir.mkdir(parents=True, exist_ok=True)
        derived_path = derived_dir / f"{vid_name}_derived.csv"
        with open(derived_path, "w", newline="", encoding="utf-8") as f:
            d_writer = csv.DictWriter(
                f, fieldnames=["frame", "object_id", "class", "x", "y", "width", "height", "center_x", "center_y", "area"]
            )
            d_writer.writeheader()
            d_writer.writerows(derived_rows)

    # 6. Save Video Metadata JSON
    metadata_dir.mkdir(parents=True, exist_ok=True)
    classes_detected = sorted(list(set(r["class"] for r in rows)))
    unique_objects = len(set(r["object_id"] for r in rows))

    metadata = {
        "video_id": vid_name,
        "filename": video_path.name,
        "fps": round(float(fps), 2),
        "frame_width": width,
        "frame_height": height,
        "total_frames": total_frames,
        "duration_seconds": duration_seconds,
        "model_name": Path(model.ckpt_path).name if hasattr(model, "ckpt_path") else "best.pt",
        "tracking_method": "bytetrack.yaml",
        "classes_detected": classes_detected,
        "trajectory_row_count": len(rows),
        "unique_object_count": unique_objects,
        "quality_warnings_count": len(warnings),
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # 7. Print Quality Summary
    print_track_quality_summary(vid_name, fps, width, height, total_frames, rows, warnings)
    print(f"[OK] Saved CSV:      {csv_path.name} ({len(rows)} detections)")
    print(f"[OK] Saved Metadata: {meta_path.name}")

    return csv_path, meta_path, metadata, warnings


def resolve_video_path(video_input: str, default_videos_dir: Path) -> Path:
    """Finds video path matching filename or stem in videos directory."""
    p = Path(video_input.strip().strip('"').strip("'"))
    if p.exists():
        return p
    candidate = default_videos_dir / p.name
    if candidate.exists():
        return candidate
    if not candidate.suffix:
        candidate_mp4 = default_videos_dir / f"{p.name}.mp4"
        if candidate_mp4.exists():
            return candidate_mp4
    return p


def main():
    default_videos_dir = PROJECT_ROOT / "videos"
    default_trajectories_dir = PROJECT_ROOT / "data" / "Trajectories"
    default_metadata_dir = PROJECT_ROOT / "data" / "Metadata"
    default_derived_dir = PROJECT_ROOT / "data" / "Trajectories" / "derived"

    # Prioritize models/best.pt, fallback to root best.pt
    candidate_models = [
        PROJECT_ROOT / "models" / "best.pt",
        PROJECT_ROOT / "best.pt",
    ]
    default_model_path = next((m for m in candidate_models if m.exists()), candidate_models[0])

    parser = argparse.ArgumentParser(
        description="Extract frame-by-frame multi-object trajectories using trained YOLO (best.pt) and ByteTrack.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--video", type=str, default=None, help="Specific video path or filename inside videos/")
    parser.add_argument("--all", action="store_true", help="Process all .mp4 videos in videos/ directory")
    parser.add_argument("--model", type=Path, default=default_model_path, help="Path to trained model weights (.pt)")
    parser.add_argument("--output-dir", type=Path, default=default_trajectories_dir, help="Directory to store trajectory CSVs")
    parser.add_argument("--metadata-dir", type=Path, default=default_metadata_dir, help="Directory to store metadata JSONs")
    parser.add_argument("--derived", action="store_true", help="Also generate derived trajectory CSV with area and centers")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    parser.add_argument("--device", type=str, default="0" if torch.cuda.is_available() else "cpu", help="CUDA device or 'cpu'")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing trajectory CSVs")

    args = parser.parse_args()

    # 1. Inspect Model
    model, class_names = inspect_model_weights(args.model)

    # 2. Select Videos
    if args.all:
        video_files = sorted(list(default_videos_dir.glob("*.mp4")))
        if not video_files:
            print(f"No .mp4 videos found in: {default_videos_dir}")
            sys.exit(1)
    elif args.video:
        v_path = resolve_video_path(args.video, default_videos_dir)
        if not v_path.exists():
            print(f"Video file not found: {args.video}")
            sys.exit(1)
        video_files = [v_path]
    else:
        # Default to interactive or listing
        avail = sorted(list(default_videos_dir.glob("*.mp4"))) if default_videos_dir.exists() else []
        if avail:
            print("\nAvailable videos in videos/:")
            for idx, v in enumerate(avail, 1):
                print(f"  [{idx}] {v.name}")
            try:
                choice = input(f"\nEnter video number (1-{len(avail)}), 'all', or path: ").strip().strip('"')
                if choice.lower() == "all":
                    video_files = avail
                elif choice.isdigit() and 1 <= int(choice) <= len(avail):
                    video_files = [avail[int(choice) - 1]]
                else:
                    video_files = [resolve_video_path(choice, default_videos_dir)]
            except (EOFError, KeyboardInterrupt):
                video_files = [avail[0]]
                print(f"\nDefaulting to first video: {video_files[0].name}")
        else:
            print(f"No videos found in {default_videos_dir}")
            sys.exit(1)

    derived_dir = default_derived_dir if args.derived else None

    # 3. Process Selected Videos
    summary_table = []
    print(f"\nBeginning processing of {len(video_files)} video(s)...")

    for v_file in video_files:
        csv_path, meta_path, meta, warnings = process_single_video(
            video_path=v_file,
            model=model,
            output_dir=args.output_dir,
            metadata_dir=args.metadata_dir,
            derived_dir=derived_dir,
            conf=args.conf,
            device=args.device,
            overwrite=args.overwrite,
        )
        summary_table.append({
            "video": v_file.stem,
            "fps": meta.get("fps", 0.0),
            "frames": meta.get("total_frames", 0),
            "classes": ", ".join(meta.get("classes_detected", [])),
            "objects": meta.get("unique_object_count", 0),
            "rows": meta.get("trajectory_row_count", 0),
            "warnings": len(warnings),
        })

    # 4. Print Master Summary Table
    print("\n" + "=" * 100)
    print("ALL VIDEOS PROCESSING SUMMARY TABLE")
    print("=" * 100)
    print(f"{'Video':<38} | {'FPS':<5} | {'Frames':<7} | {'Classes':<20} | {'Objects':<7} | {'Rows':<7} | {'Warnings':<8}")
    print("-" * 100)
    for row in summary_table:
        print(
            f"{row['video'][:38]:<38} | {row['fps']:<5.1f} | {row['frames']:<7} | "
            f"{row['classes'][:20]:<20} | {row['objects']:<7} | {row['rows']:<7} | {row['warnings']:<8}"
        )
    print("=" * 100)
    print("Processing complete. All trajectory CSVs and metadata JSONs generated.")


if __name__ == "__main__":
    main()
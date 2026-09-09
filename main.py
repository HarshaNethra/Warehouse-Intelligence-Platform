#!/usr/bin/env python3
"""
Godrej Warehouse Intelligence Platform - Unified CLI Entrypoint

Commands:
    train               Train YOLO11s baseline model on MASTER_PUBLIC_V1
    extract-frames      Extract sample frames from canonical CCTV videos
    export-trajectories Run ByteTrack tracking and export coordinate CSVs
    inspect-frame       Inspect bounding boxes and trajectory data for a video frame
"""

import argparse
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent


def cmd_train(args):
    from warehouse_training.train_baseline import train

    data_path = Path(args.data) if args.data else PROJECT_ROOT / "warehouse_training" / "MASTER_PUBLIC_V1" / "data.yaml"
    weights_path = Path(args.weights) if args.weights else PROJECT_ROOT / "yolo11s.pt"

    train(
        data_yaml=data_path,
        model_weights=weights_path,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=args.device,
    )


def cmd_extract_frames(args):
    from warehouse_training.extract_frames import extract_frames

    videos_dir = Path(args.videos_dir) if args.videos_dir else PROJECT_ROOT / "videos"
    output_dir = Path(args.output_dir) if args.output_dir else PROJECT_ROOT / "warehouse_training" / "processed" / "cctv_frames"

    extract_frames(
        videos_dir=videos_dir,
        output_base=output_dir,
        fps_sample=args.fps,
    )


def cmd_export_trajectories(args):
    from cv_pipeline.export_trajectories import inspect_model_weights, process_single_video, resolve_video_path

    default_videos = PROJECT_ROOT / "videos"
    default_output = PROJECT_ROOT / "data" / "Trajectories"
    default_metadata = PROJECT_ROOT / "data" / "Metadata"

    candidate_models = [
        PROJECT_ROOT / "models" / "best.pt",
        PROJECT_ROOT / "best.pt",
        PROJECT_ROOT / "warehouse_training" / "runs" / "yolo11s_baseline" / "weights" / "best.pt",
        PROJECT_ROOT / "yolo11s.pt",
    ]
    model_path = Path(args.model) if args.model else next((m for m in candidate_models if m.exists()), candidate_models[0])
    output_dir = Path(args.output) if args.output else default_output
    metadata_dir = Path(args.metadata_dir) if hasattr(args, "metadata_dir") and args.metadata_dir else default_metadata

    model, class_names = inspect_model_weights(model_path)

    if getattr(args, "all", False):
        video_files = sorted(list(default_videos.glob("*.mp4")))
    elif args.video:
        video_files = [resolve_video_path(args.video, default_videos)]
    else:
        avail = sorted([p for p in default_videos.glob("*.mp4")]) if default_videos.exists() else []
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
                    video_files = [resolve_video_path(choice, default_videos)]
            except (EOFError, KeyboardInterrupt):
                video_files = [avail[0]]
                print(f"\nDefaulting to: {video_files[0].name}")
        else:
            choice = input("Enter path to video file: ").strip().strip('"')
            video_files = [resolve_video_path(choice, default_videos)]

    overwrite = getattr(args, "overwrite", False)
    conf = getattr(args, "conf", 0.25)
    try:
        import torch
        device = "0" if torch.cuda.is_available() else "cpu"
    except ImportError:
        device = "cpu"

    for v_path in video_files:
        process_single_video(
            video_path=v_path,
            model=model,
            output_dir=output_dir,
            metadata_dir=metadata_dir,
            conf=conf,
            device=device,
            overwrite=overwrite,
        )


def cmd_inspect_frame(args):
    from analytics.frame_inspector import inspect_frame, resolve_video_path

    default_videos = PROJECT_ROOT / "videos"
    default_trajectories = PROJECT_ROOT / "data" / "Trajectories"

    if args.video:
        video_path = resolve_video_path(args.video, default_videos)
    else:
        avail = sorted([p for p in default_videos.glob("*.mp4")]) if default_videos.exists() else []
        if avail:
            print("\nAvailable videos in videos/:")
            for idx, v in enumerate(avail, 1):
                print(f"  [{idx}] {v.name}")
            try:
                choice = input(f"\nEnter video number (1-{len(avail)}) or path: ").strip().strip('"')
                if choice.isdigit() and 1 <= int(choice) <= len(avail):
                    video_path = avail[int(choice) - 1]
                else:
                    video_path = resolve_video_path(choice, default_videos)
            except (EOFError, KeyboardInterrupt):
                video_path = avail[0]
                print(f"\nDefaulting to: {video_path.name}")
        else:
            choice = input("Enter path to video file: ").strip().strip('"')
            video_path = resolve_video_path(choice, default_videos)

    video_stem = video_path.stem
    csv_path = default_trajectories / f"{video_stem}_trajectories.csv"

    frame_number = args.frame
    if frame_number is None:
        try:
            val = input("Enter frame number to inspect (default: 0): ").strip()
            frame_number = int(val) if val else 0
        except (EOFError, KeyboardInterrupt):
            frame_number = 0

    save_path = Path(args.save) if args.save else None
    inspect_frame(video_path, csv_path, frame_number, save_path=save_path)


def cmd_analyze_events(args):
    import json
    import cv2
    import pandas as pd
    from collections import Counter
    from behaviour_engine.rule_engine import RuleEngine
    from risk_engine.pipeline import score_and_build_events

    project_dir = PROJECT_ROOT
    default_trajectories_dir = project_dir / "data" / "Trajectories"
    default_videos_dir = project_dir / "videos"
    output_dir = Path(args.output_dir) if args.output_dir else project_dir / "data" / "Events"
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.csv:
        csv_path = Path(args.csv)
        if not csv_path.exists():
            csv_path = default_trajectories_dir / csv_path.name
        csv_files = [csv_path]
    else:
        csv_files = sorted(list(default_trajectories_dir.glob("*.csv")))

    if not csv_files:
        print(f"No trajectory CSV files found in {default_trajectories_dir}")
        return

    print("=" * 75)
    print("GODREJ WAREHOUSE INTELLIGENCE — BEHAVIOUR & RISK ANALYSIS PIPELINE")
    print("=" * 75)
    print(f"Input Trajectory Files: {len(csv_files)}")
    print(f"Output Directory:       {output_dir}")
    print("-" * 75)

    engine = RuleEngine()
    all_events_combined = []

    for csv_path in csv_files:
        video_stem = csv_path.stem.replace("_trajectories", "")
        print(f"\nProcessing: {video_stem}")

        # Check for video file to retrieve exact FPS and frame resolution
        video_file = default_videos_dir / f"{video_stem}.mp4"
        fps = args.fps or 30.0
        frame_w, frame_h = 1280, 720

        if video_file.exists():
            cap = cv2.VideoCapture(str(video_file))
            if cap.isOpened():
                v_fps = cap.get(cv2.CAP_PROP_FPS)
                if v_fps and v_fps > 0:
                    fps = v_fps
                v_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                v_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                if v_w > 0 and v_h > 0:
                    frame_w, frame_h = v_w, v_h
                cap.release()

        # Ingest and process trajectory
        tracks = engine.parse_trajectory_csv(csv_path)
        candidates = engine.process_tracks(tracks, fps=fps, video_name=video_stem)

        # Multi-factor risk scoring
        events = score_and_build_events(candidates, video_id=video_stem, fps=fps)
        all_events_combined.extend(events)

        # Save individual video events JSON
        vid_json_path = output_dir / f"{video_stem}_events.json"
        with open(vid_json_path, "w", encoding="utf-8") as f:
            json.dump(events, f, indent=2)

        # Print video summary
        level_counts = Counter(e["risk_level"] for e in events)
        beh_counts = Counter(e["behaviour"] for e in events)
        print(f"  -> Generated {len(events)} events | Critical: {level_counts['critical']}, High: {level_counts['high']}, Medium: {level_counts['medium']}, Low: {level_counts['low']}")
        for b, count in beh_counts.items():
            print(f"     * {b}: {count}")

    # Save aggregated deliverables
    all_json_path = output_dir / "all_events.json"
    with open(all_json_path, "w", encoding="utf-8") as f:
        json.dump(all_events_combined, f, indent=2)

    # Save summary CSV
    if all_events_combined:
        summary_rows = []
        for e in all_events_combined:
            summary_rows.append({
                "event_id": e["event_id"],
                "video_id": e["video_id"],
                "timestamp": e["timestamp"],
                "duration": e["duration"],
                "object_id": e["object_id"],
                "behaviour": e["behaviour"],
                "risk_score": e["risk_score"],
                "risk_level": e["risk_level"],
                "evidence_frame": e["evidence_frame"],
                "description": e["description"],
                "reason": e["reason"],
                "recommended_action": e["recommended_action"],
            })
        summary_df = pd.DataFrame(summary_rows)
        summary_csv_path = output_dir / "all_events_summary.csv"
        summary_df.to_csv(summary_csv_path, index=False)

    print("\n" + "=" * 75)
    print("PIPELINE EXECUTION COMPLETE")
    print("=" * 75)
    print(f"Total Events Detected: {len(all_events_combined)}")
    overall_levels = Counter(e["risk_level"] for e in all_events_combined)
    print(f"Overall Risk Breakdown: Critical={overall_levels['critical']}, High={overall_levels['high']}, Medium={overall_levels['medium']}, Low={overall_levels['low']}")
    print(f"Artifacts Saved:\n  - {all_json_path}\n  - {output_dir / 'all_events_summary.csv'}")


def main():
    parser = argparse.ArgumentParser(
        prog="main.py",
        description="Godrej Warehouse Intelligence Platform CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python main.py train --epochs 10 --batch 16
  python main.py extract-frames --fps 1.0
  python main.py export-trajectories --video "Dock level, dragging cupboard.mp4"
  python main.py inspect-frame --video "Dock level, dragging cupboard.mp4" --frame 50
  python main.py analyze-events
  python main.py run-rules --csv "Rolling and dropping carton_trajectories.csv"
""",
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # train
    p_train = subparsers.add_parser("train", help="Train YOLO11s baseline model on MASTER_PUBLIC_V1")
    p_train.add_argument("--data", type=str, default=None, help="Path to data.yaml")
    p_train.add_argument("--weights", type=str, default=None, help="Base model weights (.pt)")
    p_train.add_argument("--epochs", type=int, default=5, help="Number of epochs (default: 5)")
    p_train.add_argument("--batch", type=int, default=8, help="Batch size (default: 8)")
    p_train.add_argument("--imgsz", type=int, default=640, help="Image size (default: 640)")
    p_train.add_argument("--device", type=str, default="0", help="CUDA device ID or 'cpu' (default: 0)")
    p_train.set_defaults(func=cmd_train)

    # extract-frames
    p_extract = subparsers.add_parser("extract-frames", help="Extract sample frames from canonical CCTV videos")
    p_extract.add_argument("--videos-dir", type=str, default=None, help="Input videos folder (default: videos/)")
    p_extract.add_argument("--output-dir", type=str, default=None, help="Output frames folder")
    p_extract.add_argument("--fps", type=float, default=1.0, help="Sampling rate (frames per sec, default: 1.0)")
    p_extract.set_defaults(func=cmd_extract_frames)

    # export-trajectories
    p_export = subparsers.add_parser("export-trajectories", help="Run ByteTrack and export trajectory CSVs")
    p_export.add_argument("--video", type=str, default=None, help="Video path or filename in videos/")
    p_export.add_argument("--all", action="store_true", help="Process all .mp4 videos in videos/ directory")
    p_export.add_argument("--model", type=str, default=None, help="Path to YOLO weights (.pt)")
    p_export.add_argument("--output", type=str, default=None, help="Output directory for CSVs")
    p_export.add_argument("--metadata-dir", type=str, default=None, help="Output directory for metadata JSONs")
    p_export.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default: 0.25)")
    p_export.add_argument("--overwrite", action="store_true", help="Overwrite existing trajectory CSVs")
    p_export.set_defaults(func=cmd_export_trajectories)

    # inspect-frame
    p_inspect = subparsers.add_parser("inspect-frame", help="Inspect bounding boxes and trajectory data for a frame")
    p_inspect.add_argument("--video", type=str, default=None, help="Video path or filename in videos/")
    p_inspect.add_argument("--frame", type=int, default=None, help="Frame index to inspect")
    p_inspect.add_argument("--save", type=str, default=None, help="Optional path to save annotated frame image")
    p_inspect.set_defaults(func=cmd_inspect_frame)

    # analyze-events
    p_analyze = subparsers.add_parser("analyze-events", help="Run Behaviour Engine and Risk Scoring over trajectories")
    p_analyze.add_argument("--csv", type=str, default=None, help="Optional path or name of single trajectory CSV")
    p_analyze.add_argument("--output-dir", type=str, default=None, help="Directory to save JSON/CSV events")
    p_analyze.add_argument("--fps", type=float, default=None, help="Video FPS override")
    p_analyze.set_defaults(func=cmd_analyze_events)

    # run-rules (alias for analyze-events)
    p_rules = subparsers.add_parser("run-rules", help="Alias for analyze-events")
    p_rules.add_argument("--csv", type=str, default=None, help="Optional path or name of single trajectory CSV")
    p_rules.add_argument("--output-dir", type=str, default=None, help="Directory to save JSON/CSV events")
    p_rules.add_argument("--fps", type=float, default=None, help="Video FPS override")
    p_rules.set_defaults(func=cmd_analyze_events)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(0)

    args.func(args)


if __name__ == "__main__":
    main()

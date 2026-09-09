"""
Frame Inspector: Visualizes bounding boxes, classes, and coordinates for a video frame.
"""

import argparse
import sys
from pathlib import Path
import cv2
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent


def resolve_video_path(video_input: str, default_videos_dir: Path) -> Path:
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


def inspect_frame(video_path: Path, csv_path: Path, frame_number: int, save_path: Path = None):
    print("=" * 70)
    print("GODREJ CCTV FRAME INSPECTOR")
    print("=" * 70)
    print(f"Video: {video_path.name}")
    print(f"CSV:   {csv_path.name}")

    if not video_path.exists():
        raise FileNotFoundError(f"Video not found at: {video_path}")
    if not csv_path.exists():
        raise FileNotFoundError(f"Trajectory CSV not found at: {csv_path}")

    df = pd.read_csv(csv_path)

    video = cv2.VideoCapture(str(video_path))
    if not video.isOpened():
        raise RuntimeError(f"Could not open video at: {video_path}")

    fps = video.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(video.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"Actual Video FPS: {fps:.2f} | Total Frames: {total_frames}")

    if frame_number < 0 or frame_number >= total_frames:
        video.release()
        raise ValueError(f"Frame number {frame_number} is outside video range (0 - {total_frames - 1}).")

    video.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
    success, frame = video.read()
    video.release()

    if not success or frame is None:
        raise RuntimeError(f"Could not read frame {frame_number} from video.")

    timestamp = frame_number / fps
    frame_data = df[df["frame"] == frame_number]

    print("-" * 70)
    print(f"Frame Number: {frame_number} / {total_frames} | Exact Timestamp: {timestamp:.2f}s (FPS: {fps:.2f})")
    print("-" * 70)

    # Color map for classes
    color_map = {
        "person": (0, 255, 0),       # Green
        "carton": (255, 128, 0),     # Orange/Blue in BGR
        "pallet": (0, 255, 255),     # Yellow
        "pallet_jack": (255, 0, 255),# Magenta
        "forklift": (0, 0, 255),     # Red
        "trolley": (255, 255, 0),    # Cyan
        "truck": (180, 105, 255),    # Pink
    }

    # Overlay top information banner
    header_text = f"Video: {video_path.stem} | Frame: {frame_number}/{total_frames} | Time: {timestamp:.2f}s (FPS: {fps:.2f})"
    cv2.rectangle(frame, (0, 0), (frame.shape[1], 40), (20, 20, 20), -1)
    cv2.putText(frame, header_text, (15, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

    if frame_data.empty:
        print("No tracked objects recorded in this frame.")
    else:
        print(f"Tracked Objects ({len(frame_data)}):")
        print(f"  {'ID':<5} | {'Class':<12} | {'Center (X, Y)':<18} | {'Size (WxH)':<16}")
        print(f"  {'-'*5}-+-{'-'*12}-+-{'-'*18}-+-{'-'*16}")

        for _, row in frame_data.iterrows():
            obj_id = int(row["object_id"])
            cls_name = row["class"]
            x = float(row["x"])
            y = float(row["y"])
            w = float(row["width"])
            h = float(row["height"])

            print(f"  {obj_id:<5} | {cls_name:<12} | ({x:6.1f}, {y:6.1f})   | ({w:5.1f} x {h:5.1f})")

            # Center-to-corner conversion:
            x1 = max(0, int(x - w / 2))
            y1 = max(0, int(y - h / 2))
            x2 = min(frame.shape[1], int(x + w / 2))
            y2 = min(frame.shape[0], int(y + h / 2))

            color = color_map.get(cls_name, (0, 255, 0))

            # Draw bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Draw top label (ID and class)
            top_label = f"ID:{obj_id} {cls_name}"
            (tw, th), _ = cv2.getTextSize(top_label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
            cv2.rectangle(frame, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), color, -1)
            cv2.putText(frame, top_label, (x1 + 3, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 2)

            # Draw bottom label (coordinates and dimensions)
            bot_label = f"({x:.0f},{y:.0f}) {w:.0f}x{h:.0f}"
            cv2.putText(frame, bot_label, (x1, min(frame.shape[0] - 5, y2 + 15)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1)

    # Save image
    output_path = save_path or (PROJECT_ROOT / "analytics" / f"frame_{frame_number}_{video_path.stem}.jpg")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(output_path), frame)
    print(f"\n[OK] Annotated frame image saved to: {output_path}")

    # Interactive display if GUI is supported
    try:
        window_name = f"Frame {frame_number} - {video_path.name}"
        cv2.imshow(window_name, frame)
        print("Displaying frame window. Press any key to close...")
        cv2.waitKey(1000)
        cv2.destroyAllWindows()
    except cv2.error:
        pass


def main():
    analytics_dir = Path(__file__).resolve().parent
    project_dir = analytics_dir.parent
    default_videos_dir = project_dir / "videos"
    default_trajectories_dir = project_dir / "data" / "Trajectories"

    parser = argparse.ArgumentParser(description="Inspect bounding boxes and trajectory data for a specific video frame.")
    parser.add_argument("--video", type=str, default=None, help="Path to video or filename inside videos/")
    parser.add_argument("--frame", type=int, default=None, help="Frame index to inspect")
    parser.add_argument("--save", type=Path, default=None, help="Optional path to save annotated frame image")

    args = parser.parse_args()

    # Resolve video
    if args.video:
        video_path = resolve_video_path(args.video, default_videos_dir)
    else:
        avail_videos = sorted([p for p in default_videos_dir.glob("*.mp4")]) if default_videos_dir.exists() else []
        if avail_videos:
            print("\nAvailable videos in videos/:")
            for idx, v in enumerate(avail_videos, 1):
                print(f"  [{idx}] {v.name}")
            try:
                user_choice = input(f"\nEnter video number (1-{len(avail_videos)}) or path: ").strip().strip('"')
                if user_choice.isdigit() and 1 <= int(user_choice) <= len(avail_videos):
                    video_path = avail_videos[int(user_choice) - 1]
                else:
                    video_path = resolve_video_path(user_choice, default_videos_dir)
            except (EOFError, KeyboardInterrupt):
                video_path = avail_videos[0]
                print(f"\nDefaulting to first video: {video_path.name}")
        else:
            user_choice = input("Enter path to video file: ").strip().strip('"')
            video_path = resolve_video_path(user_choice, default_videos_dir)

    video_stem = video_path.stem
    csv_path = default_trajectories_dir / f"{video_stem}_trajectories.csv"

    # Resolve frame
    if args.frame is not None:
        frame_number = args.frame
    else:
        try:
            val = input("Enter frame number to inspect (default: 0): ").strip()
            frame_number = int(val) if val else 0
        except (EOFError, KeyboardInterrupt):
            frame_number = 0

    inspect_frame(video_path, csv_path, frame_number, save_path=args.save)


if __name__ == "__main__":
    main()
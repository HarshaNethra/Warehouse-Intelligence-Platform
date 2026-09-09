import argparse
from pathlib import Path
import cv2


def extract_frames(videos_dir: Path, output_base: Path, fps_sample: float = 1.0):
    output_base.mkdir(parents=True, exist_ok=True)

    if not videos_dir.exists():
        print(f"Error: Videos directory not found at {videos_dir}")
        return

    video_files = sorted([
        p for p in videos_dir.iterdir()
        if p.suffix.lower() in {".mp4", ".avi", ".mov", ".mkv"}
    ])

    print(f"Found {len(video_files)} video(s) in {videos_dir}")

    for video_path in video_files:
        output_dir = output_base / video_path.stem
        output_dir.mkdir(parents=True, exist_ok=True)

        cap = cv2.VideoCapture(str(video_path))

        if not cap.isOpened():
            print(f"ERROR: Could not open {video_path.name}")
            continue

        fps = cap.get(cv2.CAP_PROP_FPS)

        if fps <= 0:
            print(f"ERROR: Invalid FPS for {video_path.name}")
            cap.release()
            continue

        frame_interval = max(int(fps / fps_sample), 1)

        frame_count = 0
        saved_count = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % frame_interval == 0:
                output_path = output_dir / f"frame_{saved_count:06d}.jpg"
                cv2.imwrite(str(output_path), frame)
                saved_count += 1

            frame_count += 1

        cap.release()
        print(f"{video_path.name} -> {saved_count} frames saved to {output_dir.name}")

    print("Frame extraction complete.")


def main():
    project_root = Path(__file__).resolve().parent.parent
    default_videos = project_root / "videos"
    default_output = project_root / "warehouse_training" / "processed" / "cctv_frames"

    parser = argparse.ArgumentParser(description="Extract sample frames from canonical CCTV videos.")
    parser.add_argument("--videos-dir", type=Path, default=default_videos, help="Path to input videos folder")
    parser.add_argument("--output-dir", type=Path, default=default_output, help="Path to output frames folder")
    parser.add_argument("--fps", type=float, default=1.0, help="Sampling rate (frames per second)")

    args = parser.parse_args()
    extract_frames(args.videos_dir, args.output_dir, args.fps)


if __name__ == "__main__":
    main()
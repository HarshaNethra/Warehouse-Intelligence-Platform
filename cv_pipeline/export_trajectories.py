import csv
from pathlib import Path
from ultralytics import YOLO

#0 Location for model,video and storing csv
cv_pipeline_dir=Path(__file__).resolve().parent
project_dir=cv_pipeline_dir.parent

model_path=project_dir/"models"/"best.pt"
video_path=Path(input("Enter the path for the video:").strip().strip('"')) #striping extra spaces and ' " '
output_path=project_dir/"data"/"Trajectories"

#Confirmation that paths and the files exists
print("Model:",model_path)
print("Model Exists:",model_path.exists())

print("Video:",video_path)
print("Video Exists:",video_path.exists())

# 1. Load fine-tuned weights
model = YOLO(model_path)

# 2. Run object tracking
results = model.track(
    source=str(video_path),        # Update to your video name
    persist=True,               # Retains object IDs across frames
    conf=0.2,                   # Confidence threshold
    tracker="bytetrack.yaml"
)

# 3. Extract frame-by-frame coordinates
rows = []
for frame_idx, r in enumerate(results):
    if r.boxes is None or r.boxes.id is None:
        continue
        
    boxes = r.boxes.xywh.cpu().numpy()
    track_ids = r.boxes.id.cpu().numpy()
    classes = r.boxes.cls.cpu().numpy()

    for box, obj_id, cls in zip(boxes, track_ids, classes):
        x, y, w, h = box
        rows.append({
            "frame": frame_idx,
            "object_id": int(obj_id),
            "class": model.names[int(cls)],
            "x": round(float(x), 2),
            "y": round(float(y), 2),
            "width": round(float(w), 2),
            "height": round(float(h), 2)
        })

#4 save trajectory csv
output_dir=Path(output_path)
output_dir.mkdir(parents=True , exist_ok=True)
vid_name=Path(video_path).stem
output_file=output_dir/f"{vid_name}_trajectories.csv"

# 5. Save CSV deliverable
with open(output_file, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["frame", "object_id", "class", "x", "y", "width", "height"])
    writer.writeheader()
    writer.writerows(rows)

print("✅ Success! video1_trajectories.csv created.")
import cv2
import pandas as pd
from pathlib import Path

#Selecting the Paths
analytics_dir=Path(__file__).resolve().parent
project_dir=analytics_dir.parent

videos_dir=Path(input("Enter the path to the video:").strip().strip('"'))
trajectories_dir= project_dir/"data"/"Trajectories"

#check whether the path exists 
print("Video Path:",videos_dir)
print("Video Path Exists?:",videos_dir.exists())

if not videos_dir.exists():
    raise FileNotFoundError(f"video is not found at:\n{videos_dir}")

video_stem = videos_dir.stem
csv_path=trajectories_dir/f"{video_stem}_trajectories.csv"
#Check whether the file exists
if not csv_path.exists():
    raise FileNotFoundError(f"Trajecotry csv not found:{csv_path}")

df=pd.read_csv(csv_path)

#Load CSV
print("\nCSV loaded Successfully!.")
print(f"Video:{videos_dir.name}\n")
print(f"CSV:{csv_path.name}")

#Open the video

video=cv2.VideoCapture(str(videos_dir))

if not video.isOpened():
    raise RuntimeError("Couldn't Open the Video.")

fps=video.get(cv2.CAP_PROP_FPS)
total_frames=int(video.get(cv2.CAP_PROP_FRAME_COUNT))

print(f"FPS:{fps}")
print(f"Total Frames:{total_frames}")

# Taking the frame number as input

frame_number=int(input(f"\nEnter the frame number you want to inspect(0-{total_frames -1}):"))

if  frame_number < 0 or frame_number >=total_frames:
    raise ValueError("Enterd Value is outside of the video range!.")

# Jump to the given/chosen frame

video.set(cv2.CAP_PROP_POS_FRAMES,frame_number)

success, frame=video.read()

if not success:
    raise RuntimeError("Could not load the requested frame")

# get csv data for this frame

frame_data=df[df["frame"]==frame_number]

# draw the frame box

for _,row in frame_data.iterrows():
    object_id=int(row["object_id"])
    class_name = row["class"]

    x=float(row["x"])
    y=float(row["y"])
    width=float(row["width"])
    height=float(row["height"])

    #Convert the center into the targeted person center
    x1=int(x-width/2)
    y1=int(y-height/2)

    x2=int(x-width/2)
    y2=int(y-height/2)

    # Draw a bounding box for the class

    cv2.rectangle(
        frame,
        (x1,y1),
        (x2,y2),
        (0,255,0),
        2
    )
    #label 
    label =f"ID {object_id}| {class_name}"

    cv2.putText(
        frame,
        label,
        (x1,max(y1-10,20)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (0,255,0),
        2
    )
# Display the info
print("\n======================================")
print(f"Frame:{frame_number}")
print(f"Time: {frame_number /fps:.2f}seconds")
print("\n======================================")

if frame_data.empty:
    print("NO tracked objects were recorded in this frame.")
else:
    print("\n Tracked objects:")
    for _,row in frame_data.iterrows():
        print(
            f"\n Object ID:{int(row['object_id'])}"
            f"\n Class:{row['class']}"
            f"\n X:{row['x']}"
            f"\n Y:{row['y']}"
            f"\n Width:{row['width']}"
            f"\n Height:{row['height']}"
        )

# Show the selected Frame
cv2.imshow(
    f"Frame:{frame_number}",
    frame
)

print("\nPress any key inside the video window to close.")

cv2.waitKey(0)
cv2.destroyAllWindows()

video.release()
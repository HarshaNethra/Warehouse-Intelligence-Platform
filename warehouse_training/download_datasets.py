from pathlib import Path
import os
from roboflow import Roboflow

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD_ROOT = (
    PROJECT_ROOT
    / "warehouse_training"
    / "raw"
    / "public_datasets"
)

DOWNLOAD_ROOT.mkdir(parents=True, exist_ok=True)

api_key = os.environ.get("ROBOFLOW_API_KEY")

if not api_key:
    raise RuntimeError(
        "ROBOFLOW_API_KEY is not set in this PowerShell session."
    )

rf = Roboflow(api_key=api_key)

DATASETS = [
    {
        "name": "Logistics",
        "workspace": "large-benchmark-datasets",
        "project": "logistics-sz9jr",
        "version": 2,
        "folder": "Logistics-2",
    },
    {
        "name": "Warehouse Item",
        "workspace": "obb-dxzbw",
        "project": "warehouse-item",
        "version": 1,
        "folder": "Warehouse-Item-1",
    },
    {
        "name": "Addverb",
        "workspace": "addverb-technologies",
        "project": "warehouse-ijyxt",
        "version": 1,
        "folder": "Warehouse-1",
    },
]

for item in DATASETS:

    print("\n" + "=" * 70)
    print(f"DOWNLOADING: {item['name']}")
    print("=" * 70)

    destination = DOWNLOAD_ROOT / item["folder"]
    destination.mkdir(parents=True, exist_ok=True)

    project = (
        rf.workspace(item["workspace"])
        .project(item["project"])
    )

    version = project.version(item["version"])

    print(f"Destination: {destination}")

    dataset = version.download(
        "yolov11",
        location=str(destination)
    )

    print(f"\nRoboflow reported: {dataset.location}")

    print("Files currently present:")
    for p in destination.iterdir():
        print("  ", p.name)

print("\n" + "=" * 70)
print("ALL THREE DOWNLOADS FINISHED")
print("=" * 70)
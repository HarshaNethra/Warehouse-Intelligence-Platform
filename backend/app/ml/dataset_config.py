import os
from pathlib import Path
from typing import Dict, Any, Optional

try:
    import yaml
    HAS_PYYAML = True
except ImportError:
    HAS_PYYAML = False

CLASS_NAMES = [
    "person", "carton", "pallet", "pallet_jack", 
    "forklift", "trolley", "truck", "mattress", "dock_gap", "strap"
]

def find_dataset_root() -> Path:
    """
    Dynamically locates the warehouse training dataset directory regardless of environment base path.
    """
    curr_dir = Path(__file__).resolve().parent
    
    candidates = [
        curr_dir.parent.parent.parent / "Godrej" / "warehouse_training" / "MASTER_PUBLIC_V1",
        curr_dir.parent.parent / "Godrej" / "warehouse_training" / "MASTER_PUBLIC_V1",
        Path.cwd() / "Godrej" / "warehouse_training" / "MASTER_PUBLIC_V1",
        Path.cwd().parent / "Godrej" / "warehouse_training" / "MASTER_PUBLIC_V1",
        Path("/Users/gankai/Desktop/training-data/Godrej/warehouse_training/MASTER_PUBLIC_V1")
    ]

    for path in candidates:
        if path.exists() and (path / "images").exists():
            return path.resolve()
            
    # Fallback to candidate 0
    fallback = candidates[0].resolve()
    fallback.mkdir(parents=True, exist_ok=True)
    return fallback

def _format_yaml(config_data: Dict[str, Any]) -> str:
    """
    Zero-dependency YAML formatter for Ultralytics dataset configurations.
    """
    if HAS_PYYAML:
        return yaml.dump(config_data, default_flow_style=False, sort_keys=False)

    lines = [
        f"path: {config_data['path']}",
        f"train: {config_data['train']}",
        f"val: {config_data['val']}"
    ]
    if config_data.get("test"):
        lines.append(f"test: {config_data['test']}")
    lines.append("names:")
    for idx, name in config_data.get("names", {}).items():
        lines.append(f"  {idx}: {name}")
    return "\n".join(lines) + "\n"

def generate_dataset_yaml(output_yaml_path: Optional[str] = None) -> str:
    """
    Generates an absolute-path resolved YAML file for Ultralytics YOLO training.
    Prevents path mismatches across macOS, Linux, and Windows.
    """
    dataset_dir = find_dataset_root()
    
    if output_yaml_path is None:
        target_dir = Path(__file__).resolve().parent
        target_dir.mkdir(parents=True, exist_ok=True)
        output_yaml_path = str(target_dir / "warehouse_dataset.yaml")

    config_data: Dict[str, Any] = {
        "path": str(dataset_dir),
        "train": "images/train" if (dataset_dir / "images" / "train").exists() else "images",
        "val": "images/val" if (dataset_dir / "images" / "val").exists() else "images",
        "test": "images/test" if (dataset_dir / "images" / "test").exists() else None,
        "names": {i: name for i, name in enumerate(CLASS_NAMES)}
    }

    content = _format_yaml(config_data)

    with open(output_yaml_path, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"[DatasetConfig] Dynamically generated dataset configuration YAML at: {output_yaml_path}")
    print(f"[DatasetConfig] Resolved dataset root: {dataset_dir}")
    return output_yaml_path

if __name__ == "__main__":
    generated_path = generate_dataset_yaml()
    print(f"Generated YAML at: {generated_path}")

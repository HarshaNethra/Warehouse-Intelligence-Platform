import argparse
import multiprocessing
from pathlib import Path
import torch
from ultralytics import YOLO


def train(data_yaml: Path, model_weights: Path, epochs: int = 5, batch: int = 8, imgsz: int = 640, device: str = "0"):
    base_dir = Path(__file__).resolve().parent
    runs_dir = base_dir / "runs"

    print("=" * 60)
    print("YOLO11s BASELINE TRAINING")
    print("=" * 60)
    print("PyTorch Version:", torch.__version__)
    print("CUDA Available: ", torch.cuda.is_available())

    if torch.cuda.is_available():
        print("GPU Device:     ", torch.cuda.get_device_name(0))
        actual_device = device
    else:
        print("WARNING: CUDA not available. Running on CPU.")
        actual_device = "cpu"

    print(f"Dataset Config:  {data_yaml} (Exists: {data_yaml.exists()})")
    print(f"Base Weights:    {model_weights} (Exists: {model_weights.exists()})")

    if not data_yaml.exists():
        raise FileNotFoundError(
            f"Dataset configuration not found at {data_yaml}.\n"
            f"If training locally, please ensure MASTER_PUBLIC_V1.zip is extracted into {base_dir / 'MASTER_PUBLIC_V1'}."
        )

    model = YOLO(str(model_weights))

    model.train(
        data=str(data_yaml),
        epochs=epochs,
        imgsz=imgsz,
        batch=batch,
        device=actual_device,
        workers=2 if actual_device != "cpu" else 0,
        project=str(runs_dir),
        name="yolo11s_baseline",
        exist_ok=True,
        pretrained=True,
    )

    print("\n✅ Training complete.")


def main():
    base_dir = Path(__file__).resolve().parent
    project_root = base_dir.parent
    default_yaml = base_dir / "MASTER_PUBLIC_V1" / "data.yaml"
    default_weights = project_root / "yolo11s.pt"

    parser = argparse.ArgumentParser(description="Train YOLO11s baseline model on MASTER_PUBLIC_V1.")
    parser.add_argument("--data", type=Path, default=default_yaml, help="Path to dataset data.yaml")
    parser.add_argument("--weights", type=Path, default=default_weights, help="Path to base weights (.pt)")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=8, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size")
    parser.add_argument("--device", type=str, default="0", help="CUDA device ID or 'cpu'")

    args = parser.parse_args()
    train(args.data, args.weights, epochs=args.epochs, batch=args.batch, imgsz=args.imgsz, device=args.device)


if __name__ == "__main__":
    multiprocessing.freeze_support()
    main()
"""
prepare_kaggle_dataset.py

Validates the local MASTER_PUBLIC_V1 dataset and archives it directly into
a single MASTER_PUBLIC_V1.zip file suitable for upload as a Kaggle Dataset.

Guarantees:
- NO duplicate raw directory copies are created on disk.
- Validates split counts: train (57,908), val (9,963), test (4,458).
- Validates label-to-image parity and class definitions in data.yaml.
- Measures and reports actual output archive size on disk.
"""

from pathlib import Path
import sys
import time
import zipfile
import yaml

# ============================================================
# CONFIGURATION
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
BASE_DIR = PROJECT_ROOT / "warehouse_training"
DATASET_DIR = BASE_DIR / "MASTER_PUBLIC_V1"
OUTPUT_ZIP = BASE_DIR / "MASTER_PUBLIC_V1.zip"

EXPECTED_COUNTS = {
    "train": (57908, 57908),
    "val": (9963, 9963),
    "test": (4458, 4458),
}

EXPECTED_CLASSES = {
    0: "person",
    1: "carton",
    2: "pallet",
    3: "pallet_jack",
    4: "forklift",
    5: "trolley",
    6: "truck",
}

# ============================================================
# PRE-FLIGHT VALIDATION
# ============================================================

def validate_dataset(dataset_dir: Path) -> list[Path]:
    """
    Validates dataset structure, counts, and data.yaml.
    Returns list of all files to be included in the archive.
    """
    print("=" * 70)
    print("1. PRE-FLIGHT VALIDATION: MASTER_PUBLIC_V1")
    print("=" * 70)
    print(f"Dataset location: {dataset_dir}")

    if not dataset_dir.exists():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")

    # Check data.yaml
    yaml_path = dataset_dir / "data.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(f"data.yaml not found: {yaml_path}")

    with open(yaml_path, "r", encoding="utf-8") as f:
        yaml_content = yaml.safe_load(f)

    classes_in_yaml = yaml_content.get("names", {})
    if isinstance(classes_in_yaml, list):
        classes_in_yaml = dict(enumerate(classes_in_yaml))

    print("\nValidating class mapping in data.yaml:")
    for class_id, expected_name in EXPECTED_CLASSES.items():
        actual_name = classes_in_yaml.get(class_id)
        if actual_name != expected_name:
            raise ValueError(
                f"Class mapping mismatch at ID {class_id}: "
                f"expected '{expected_name}', got '{actual_name}'"
            )
        print(f"  [{class_id}] {expected_name:<15} -> OK")

    files_to_pack: list[Path] = [yaml_path]

    print("\nValidating image & label counts per split:")
    print("-" * 70)
    print(f"{'Split':<10} {'Images Found':<15} {'Expected':<12} {'Labels Found':<15} {'Expected':<12} {'Status'}")
    print("-" * 70)

    for split, (exp_imgs, exp_lbls) in EXPECTED_COUNTS.items():
        img_dir = dataset_dir / "images" / split
        lbl_dir = dataset_dir / "labels" / split

        if not img_dir.exists():
            raise FileNotFoundError(f"Missing images directory: {img_dir}")
        if not lbl_dir.exists():
            raise FileNotFoundError(f"Missing labels directory: {lbl_dir}")

        imgs = [p for p in img_dir.iterdir() if p.is_file()]
        lbls = [p for p in lbl_dir.iterdir() if p.is_file()]

        img_count = len(imgs)
        lbl_count = len(lbls)

        is_valid = (img_count == exp_imgs) and (lbl_count == exp_lbls)
        status = "OK" if is_valid else "MISMATCH"

        print(f"{split:<10} {img_count:<15,d} {exp_imgs:<12,d} {lbl_count:<15,d} {exp_lbls:<12,d} {status}")

        if not is_valid:
            raise ValueError(
                f"Count mismatch in split '{split}': "
                f"Images {img_count}/{exp_imgs}, Labels {lbl_count}/{exp_lbls}"
            )

        files_to_pack.extend(imgs)
        files_to_pack.extend(lbls)

    total_expected_files = 1 + sum(exp_img + exp_lbl for exp_img, exp_lbl in EXPECTED_COUNTS.values())
    print("-" * 70)
    print(f"Total files validated: {len(files_to_pack):,d} (Expected: {total_expected_files:,d})")
    print("Pre-flight validation PASSED.")
    return files_to_pack

# ============================================================
# ARCHIVE CREATION
# ============================================================

def create_kaggle_zip(dataset_dir: Path, output_zip: Path, files_to_pack: list[Path]):
    """
    Streams all validated files directly into a single ZIP archive.
    No temporary folders or duplicate directory copies are made.
    """
    print("\n" + "=" * 70)
    print("2. PACKAGING DATASET FOR KAGGLE")
    print("=" * 70)
    print(f"Target archive: {output_zip}")

    total_uncompressed_bytes = sum(f.stat().st_size for f in files_to_pack)
    print(f"Uncompressed source size: {total_uncompressed_bytes / (1024**3):.2f} GB ({total_uncompressed_bytes:,d} bytes)")

    if output_zip.exists():
        print(f"WARNING: Existing archive found at {output_zip}. It will be overwritten.")

    start_time = time.time()
    total_files = len(files_to_pack)
    processed_bytes = 0

    # Using ZIP_DEFLATED with compresslevel=1 for fast streaming compression
    with zipfile.ZipFile(output_zip, mode="w", compression=zipfile.ZIP_DEFLATED, compresslevel=1) as zf:
        for idx, file_path in enumerate(files_to_pack, start=1):
            # Archive structure: MASTER_PUBLIC_V1/images/... and MASTER_PUBLIC_V1/data.yaml
            arcname = file_path.relative_to(dataset_dir.parent)
            zf.write(file_path, arcname=arcname)
            processed_bytes += file_path.stat().st_size

            if idx % 10000 == 0 or idx == total_files:
                elapsed = time.time() - start_time
                pct = (idx / total_files) * 100
                speed = (processed_bytes / (1024**2)) / max(elapsed, 0.001)
                print(f"  [{idx:>7,d}/{total_files:,d}] ({pct:5.1f}%) | {elapsed:5.1f}s elapsed | Speed: {speed:5.1f} MB/s")

    elapsed_total = time.time() - start_time
    final_zip_bytes = output_zip.stat().st_size
    final_zip_gb = final_zip_bytes / (1024**3)
    ratio = (1 - (final_zip_bytes / max(total_uncompressed_bytes, 1))) * 100

    print("\n" + "=" * 70)
    print("3. PACKAGING SUMMARY")
    print("=" * 70)
    print(f"Archive created:          {output_zip.name}")
    print(f"Archive absolute path:    {output_zip}")
    print(f"Actual resulting size:    {final_zip_gb:.2f} GB ({final_zip_bytes:,d} bytes)")
    print(f"Uncompressed size:        {total_uncompressed_bytes / (1024**3):.2f} GB ({total_uncompressed_bytes:,d} bytes)")
    print(f"Space saved:              {ratio:.1f}%")
    print(f"Total files archived:     {total_files:,d}")
    print(f"Total time taken:         {elapsed_total:.1f}s ({elapsed_total / 60:.2f} minutes)")
    print("=" * 70)

# ============================================================
# MAIN ENTRYPOINT
# ============================================================

def main():
    validate_only = "--validate-only" in sys.argv

    files_to_pack = validate_dataset(DATASET_DIR)

    if validate_only:
        print("\n[--validate-only flag detected]: Skipping ZIP creation.")
        return

    create_kaggle_zip(DATASET_DIR, OUTPUT_ZIP, files_to_pack)

if __name__ == "__main__":
    main()

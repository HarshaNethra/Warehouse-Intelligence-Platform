from pathlib import Path
import yaml
import shutil
from collections import Counter

# ============================================================
# PROJECT PATHS
# ============================================================

PROJECT_ROOT = Path(r"C:\Users\Srikiran\Godrej")
BASE = PROJECT_ROOT / "warehouse_training"

MASTER = BASE / "MASTER_PUBLIC_V1"

# Source datasets already downloaded on the laptop
SOURCE_DATASETS = {
    "logistics": PROJECT_ROOT / "Logistics-2",
    "warehouse_item": PROJECT_ROOT / "Warehouse-Item-1",
    "addverb": PROJECT_ROOT / "Warehouse-1",
}

# ============================================================
# MASTER CLASSES
# ============================================================

MASTER_CLASSES = [
    "person",
    "carton",
    "pallet",
    "pallet_jack",
    "forklift",
    "trolley",
    "truck",
]

CLASS_TO_ID = {
    name: i
    for i, name in enumerate(MASTER_CLASSES)
}

# ============================================================
# SOURCE -> MASTER CLASS MAPPING
# ============================================================

SOURCE_TO_MASTER = {

    # -------------------------
    # Logistics
    # -------------------------
    "barcode": None,
    "car": None,
    "cardboard box": "carton",
    "fire": None,
    "forklift": "forklift",
    "freight container": None,
    "gloves": None,
    "helmet": None,
    "ladder": None,
    "license plate": None,
    "person": "person",
    "qr code": None,
    "road sign": None,
    "safety vest": None,
    "smoke": None,
    "traffic cone": None,
    "traffic light": None,
    "truck": "truck",
    "van": None,
    "wood pallet": "pallet",

    # -------------------------
    # Warehouse Item
    # -------------------------
    # cardboard box -> carton
    # forklift -> forklift
    # person -> person
    # wood pallet -> pallet

    # -------------------------
    # Addverb
    # -------------------------
    "AMR": None,
    "cart": "trolley",
    "pallet": "pallet",
    "palletjack": "pallet_jack",
}

IMAGE_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".bmp",
    ".webp",
}

# ============================================================
# CREATE MASTER DATASET STRUCTURE
# ============================================================

for split in ["train", "val", "test"]:

    (MASTER / "images" / split).mkdir(
        parents=True,
        exist_ok=True
    )

    (MASTER / "labels" / split).mkdir(
        parents=True,
        exist_ok=True
    )

print("=" * 70)
print("MASTER DATASET")
print("=" * 70)
print("Location:", MASTER)

# ============================================================
# NORMALIZE CLASS NAME
# ============================================================

def normalize_class_name(name):
    return str(name).strip().lower()


# ============================================================
# LOAD DATASET CLASS NAMES
# ============================================================

def load_class_names(dataset_path):

    yaml_path = dataset_path / "data.yaml"

    if not yaml_path.exists():
        raise FileNotFoundError(
            f"data.yaml not found: {yaml_path}"
        )

    with open(
        yaml_path,
        "r",
        encoding="utf-8"
    ) as f:

        data = yaml.safe_load(f)

    names = data["names"]

    if isinstance(names, dict):

        names = [
            names[k]
            for k in sorted(
                names,
                key=lambda x: int(x)
            )
        ]

    return names


# ============================================================
# MERGE ONE DATASET
# ============================================================

def merge_source_dataset(
    source_name,
    dataset_path
):

    print("\n" + "=" * 70)
    print(f"MERGING: {source_name}")
    print("=" * 70)

    print("Dataset:", dataset_path)

    if not dataset_path.exists():

        print("ERROR: Dataset does not exist")
        return

    source_classes = load_class_names(dataset_path)

    print("\nSource classes:")

    for i, name in enumerate(source_classes):
        print(f"  {i}: {name}")

    # --------------------------------------------------------
    # Build source ID -> master ID mapping
    # --------------------------------------------------------

    id_mapping = {}

    for source_id, source_class in enumerate(
        source_classes
    ):

        normalized = normalize_class_name(
            source_class
        )

        master_name = SOURCE_TO_MASTER.get(
            normalized
        )

        # Handle original capitalization
        if master_name is None:

            master_name = SOURCE_TO_MASTER.get(
                source_class
            )

        if master_name is None:

            id_mapping[source_id] = None

        else:

            id_mapping[source_id] = CLASS_TO_ID[
                master_name
            ]

    print("\nID mapping:")

    for source_id, master_id in id_mapping.items():

        source_display = source_classes[
            source_id
        ]

        if master_id is None:

            print(
                f"  {source_id}: "
                f"{source_display} -> DISCARD"
            )

        else:

            print(
                f"  {source_id}: "
                f"{source_display} -> "
                f"{MASTER_CLASSES[master_id]}"
            )

    # --------------------------------------------------------
    # Process splits
    # --------------------------------------------------------

    split_mapping = {
        "train": "train",
        "val": "valid",
        "test": "test",
    }

    for master_split, source_split in split_mapping.items():

        source_split_dir = (
            dataset_path / source_split
        )

        if not source_split_dir.exists():

            print(
                f"\n{master_split}: "
                f"source split does not exist - skipping"
            )

            continue

        source_images = (
            source_split_dir / "images"
        )

        source_labels = (
            source_split_dir / "labels"
        )

        if not source_images.exists():

            print(
                f"\n{master_split}: "
                f"images directory missing - skipping"
            )

            continue

        if not source_labels.exists():

            print(
                f"\n{master_split}: "
                f"labels directory missing - skipping"
            )

            continue

        image_files = [

            p

            for p in source_images.iterdir()

            if (
                p.is_file()
                and
                p.suffix.lower()
                in IMAGE_EXTENSIONS
            )
        ]

        print(
            f"\n{master_split}: "
            f"{len(image_files):,} source images"
        )

        kept = 0
        discarded = 0
        annotations = 0

        # ----------------------------------------------------
        # Process every image
        # ----------------------------------------------------

        for file_counter, image_path in enumerate(
            image_files,
            start=1
        ):

            label_path = (
                source_labels
                /
                f"{image_path.stem}.txt"
            )

            if not label_path.exists():

                discarded += 1
                continue

            new_annotations = []

            try:

                with open(
                    label_path,
                    "r",
                    encoding="utf-8"
                ) as f:

                    lines = f.readlines()

            except Exception:

                discarded += 1
                continue

            # ------------------------------------------------
            # Convert annotations
            # ------------------------------------------------

            for line in lines:

                parts = line.strip().split()

                if len(parts) != 5:
                    continue

                try:

                    source_id = int(parts[0])

                    x = float(parts[1])
                    y = float(parts[2])
                    w = float(parts[3])
                    h = float(parts[4])

                except ValueError:

                    continue

                if source_id not in id_mapping:
                    continue

                master_id = id_mapping[
                    source_id
                ]

                # Ignore irrelevant classes
                if master_id is None:
                    continue

                # Validate YOLO coordinates
                if not (
                    0 <= x <= 1
                    and
                    0 <= y <= 1
                    and
                    0 < w <= 1
                    and
                    0 < h <= 1
                ):
                    continue

                new_annotations.append(
                    f"{master_id} "
                    f"{x:.6f} "
                    f"{y:.6f} "
                    f"{w:.6f} "
                    f"{h:.6f}"
                )

            # ------------------------------------------------
            # If no relevant annotations remain
            # ------------------------------------------------

            if not new_annotations:

                discarded += 1
                continue

            # ------------------------------------------------
            # Create unique filename
            # ------------------------------------------------

            new_filename = (
                f"{source_name}_"
                f"{master_split}_"
                f"{file_counter:08d}"
                f"{image_path.suffix.lower()}"
            )

            destination_image = (
                MASTER
                /
                "images"
                /
                master_split
                /
                new_filename
            )

            destination_label = (
                MASTER
                /
                "labels"
                /
                master_split
                /
                f"{Path(new_filename).stem}.txt"
            )

            # ------------------------------------------------
            # Windows-safe COPY
            # ------------------------------------------------

            try:

                shutil.copy2(
                    image_path,
                    destination_image
                )

            except Exception as e:

                print(
                    f"ERROR copying "
                    f"{image_path.name}: {e}"
                )

                discarded += 1
                continue

            # ------------------------------------------------
            # Save converted labels
            # ------------------------------------------------

            try:

                with open(
                    destination_label,
                    "w",
                    encoding="utf-8"
                ) as f:

                    f.write(
                        "\n".join(
                            new_annotations
                        )
                    )

            except Exception as e:

                print(
                    f"ERROR writing label "
                    f"{destination_label.name}: {e}"
                )

                destination_image.unlink(
                    missing_ok=True
                )

                discarded += 1
                continue

            kept += 1
            annotations += len(
                new_annotations
            )

        print(
            f"  kept:        {kept:,}"
        )

        print(
            f"  discarded:   {discarded:,}"
        )

        print(
            f"  annotations: {annotations:,}"
        )


# ============================================================
# VERIFY SOURCE DATASETS
# ============================================================

print("\n" + "=" * 70)
print("CHECKING SOURCE DATASETS")
print("=" * 70)

for name, path in SOURCE_DATASETS.items():

    print(
        f"{name:20} -> {path}"
    )

    if not path.exists():

        print(
            f"  ERROR: Missing dataset!"
        )

# ============================================================
# MERGE ALL DATASETS
# ============================================================

for source_name, source_path in SOURCE_DATASETS.items():

    merge_source_dataset(
        source_name,
        source_path
    )

# ============================================================
# POST-MERGE VALIDATION
# ============================================================

print("\n" + "=" * 70)
print("POST-MERGE CLASS DISTRIBUTION")
print("=" * 70)

for split in ["train", "val", "test"]:

    label_dir = (
        MASTER
        /
        "labels"
        /
        split
    )

    image_dir = (
        MASTER
        /
        "images"
        /
        split
    )

    class_counts = Counter()

    total_boxes = 0
    empty_labels = 0
    invalid_labels = 0

    label_files = list(
        label_dir.glob("*.txt")
    )

    image_files = [
        p
        for p in image_dir.iterdir()
        if p.is_file()
        and p.suffix.lower()
        in IMAGE_EXTENSIONS
    ]

    for label_file in label_files:

        try:

            lines = [
                line.strip()
                for line in label_file.read_text(
                    encoding="utf-8"
                ).splitlines()
                if line.strip()
            ]

        except Exception:

            invalid_labels += 1
            continue

        if not lines:

            empty_labels += 1
            continue

        for line in lines:

            parts = line.split()

            if len(parts) != 5:

                invalid_labels += 1
                continue

            try:

                class_id = int(
                    parts[0]
                )

            except ValueError:

                invalid_labels += 1
                continue

            if class_id not in range(
                len(MASTER_CLASSES)
            ):

                invalid_labels += 1
                continue

            class_counts[
                class_id
            ] += 1

            total_boxes += 1

    print(
        f"\n{split.upper()}"
    )

    print("-" * 50)

    print(
        f"Images:        {len(image_files):,}"
    )

    print(
        f"Label files:   {len(label_files):,}"
    )

    print(
        f"Total boxes:   {total_boxes:,}"
    )

    print(
        f"Empty labels:  {empty_labels:,}"
    )

    print(
        f"Invalid:       {invalid_labels:,}"
    )

    for class_id, class_name in enumerate(
        MASTER_CLASSES
    ):

        count = class_counts[
            class_id
        ]

        percentage = (
            100 * count / total_boxes
            if total_boxes
            else 0
        )

        print(
            f"{class_id}: "
            f"{class_name:<12} "
            f"{count:>8,} "
            f"({percentage:6.2f}%)"
        )


# ============================================================
# CREATE YOLO DATA.YAML
# ============================================================

PUBLIC_YAML = (
    MASTER
    /
    "data.yaml"
)

data = {

    "path": str(MASTER),

    "train": "images/train",

    "val": "images/val",

    "test": "images/test",

    "names": {
        0: "person",
        1: "carton",
        2: "pallet",
        3: "pallet_jack",
        4: "forklift",
        5: "trolley",
        6: "truck",
    },
}

with open(
    PUBLIC_YAML,
    "w",
    encoding="utf-8"
) as f:

    yaml.safe_dump(
        data,
        f,
        sort_keys=False
    )

print("\n" + "=" * 70)
print("DATASET YAML CREATED")
print("=" * 70)

print(
    PUBLIC_YAML
)

print(
    "\n" + PUBLIC_YAML.read_text(
        encoding="utf-8"
    )
)

print("\n" + "=" * 70)
print("MERGING COMPLETE")
print("=" * 70)
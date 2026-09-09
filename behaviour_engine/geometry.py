"""
Pure spatial and geometric functions for YOLO (center_x, center_y, width, height) bounding boxes.

All functions are stateless, deterministic, and unit-testable.
Coordinates assume:
    x: center x
    y: center y
    w: width
    h: height
"""

import math
from typing import Tuple


def to_corners(x: float, y: float, w: float, h: float) -> Tuple[float, float, float, float]:
    """Convert (center_x, center_y, width, height) to (x1, y1, x2, y2) top-left and bottom-right."""
    x1 = x - (w / 2.0)
    y1 = y - (h / 2.0)
    x2 = x + (w / 2.0)
    y2 = y + (h / 2.0)
    return (x1, y1, x2, y2)


def to_center(x1: float, y1: float, x2: float, y2: float) -> Tuple[float, float, float, float]:
    """Convert (x1, y1, x2, y2) to (center_x, center_y, width, height)."""
    w = max(0.0, x2 - x1)
    h = max(0.0, y2 - y1)
    cx = x1 + (w / 2.0)
    cy = y1 + (h / 2.0)
    return (cx, cy, w, h)


def box_area(w: float, h: float) -> float:
    """Calculate rectangular bounding box area."""
    return max(0.0, float(w)) * max(0.0, float(h))


def center_distance(x_a: float, y_a: float, x_b: float, y_b: float) -> float:
    """Euclidean distance between the centers of two bounding boxes."""
    return math.hypot(x_a - x_b, y_a - y_b)


def box_intersection(box_a: Tuple[float, float, float, float],
                     box_b: Tuple[float, float, float, float]) -> float:
    """
    Calculate intersection area between two boxes in (x, y, w, h) center format.
    Returns 0.0 if boxes do not intersect.
    """
    a_x1, a_y1, a_x2, a_y2 = to_corners(*box_a)
    b_x1, b_y1, b_x2, b_y2 = to_corners(*box_b)

    inter_x1 = max(a_x1, b_x1)
    inter_y1 = max(a_y1, b_y1)
    inter_x2 = min(a_x2, b_x2)
    inter_y2 = min(a_y2, b_y2)

    inter_w = max(0.0, inter_x2 - inter_x1)
    inter_h = max(0.0, inter_y2 - inter_y1)

    return inter_w * inter_h


def box_iou(box_a: Tuple[float, float, float, float],
            box_b: Tuple[float, float, float, float]) -> float:
    """
    Intersection-over-Union (IoU) between two boxes in (x, y, w, h) format.
    Returns float in range [0.0, 1.0].
    """
    area_a = box_area(box_a[2], box_a[3])
    area_b = box_area(box_b[2], box_b[3])

    if area_a <= 0.0 or area_b <= 0.0:
        return 0.0

    inter = box_intersection(box_a, box_b)
    union = area_a + area_b - inter
    if union <= 0.0:
        return 0.0

    return inter / union


def overlap_ratio(box_a: Tuple[float, float, float, float],
                  box_b: Tuple[float, float, float, float]) -> float:
    """
    Calculates intersection area divided by the area of box_a:
    overlap_ratio = inter / area(box_a)
    Useful for containment or partial coverage checks.
    """
    area_a = box_area(box_a[2], box_a[3])
    if area_a <= 0.0:
        return 0.0
    return box_intersection(box_a, box_b) / area_a


def horizontal_overlap_ratio(box_a: Tuple[float, float, float, float],
                             box_b: Tuple[float, float, float, float]) -> float:
    """
    Calculates 1D horizontal overlap fraction between two boxes relative to min(width_a, width_b).
    Used in stacking alignment checks.
    """
    a_x1, _, a_x2, _ = to_corners(*box_a)
    b_x1, _, b_x2, _ = to_corners(*box_b)

    inter_w = max(0.0, min(a_x2, b_x2) - max(a_x1, b_x1))
    min_w = min(box_a[2], box_b[2])
    if min_w <= 0.0:
        return 0.0
    return inter_w / min_w


def vertical_overlap_ratio(box_a: Tuple[float, float, float, float],
                           box_b: Tuple[float, float, float, float]) -> float:
    """
    Calculates 1D vertical overlap fraction between two boxes relative to min(height_a, height_b).
    """
    _, a_y1, _, a_y2 = to_corners(*box_a)
    _, b_y1, _, b_y2 = to_corners(*box_b)

    inter_h = max(0.0, min(a_y2, b_y2) - max(a_y1, b_y1))
    min_h = min(box_a[3], box_b[3])
    if min_h <= 0.0:
        return 0.0
    return inter_h / min_h


def object_above_object(box_upper: Tuple[float, float, float, float],
                        box_lower: Tuple[float, float, float, float],
                        max_gap_px: float = 40.0,
                        min_horiz_overlap: float = 0.35) -> bool:
    """
    Returns True if box_upper is resting vertically above box_lower.
    Checks that:
      1. box_upper center_y is above box_lower center_y.
      2. bottom of box_upper is near top of box_lower (within max_gap_px or slightly overlapping).
      3. horizontal alignment meets min_horiz_overlap.
    """
    _, _, _, upper_y2 = to_corners(*box_upper)
    _, lower_y1, _, _ = to_corners(*box_lower)

    # Upper bottom should be close to lower top
    vertical_gap = lower_y1 - upper_y2
    # Allow small penetration (up to 30px overlap) or small separation (up to max_gap_px)
    if -30.0 <= vertical_gap <= max_gap_px:
        horiz_overlap = horizontal_overlap_ratio(box_upper, box_lower)
        return horiz_overlap >= min_horiz_overlap

    return False


def object_below_object(box_lower: Tuple[float, float, float, float],
                        box_upper: Tuple[float, float, float, float],
                        max_gap_px: float = 40.0,
                        min_horiz_overlap: float = 0.35) -> bool:
    """Inverse of object_above_object."""
    return object_above_object(box_upper, box_lower, max_gap_px, min_horiz_overlap)


def is_near_floor(y: float, h: float, frame_height: int = 720, floor_y_ratio: float = 0.60) -> bool:
    """
    Evaluates whether the bottom edge of a bounding box lies in the warehouse floor zone.
    bottom_y = y + (h / 2.0)
    floor threshold = frame_height * floor_y_ratio
    """
    bottom_y = y + (h / 2.0)
    return bottom_y >= (frame_height * floor_y_ratio)


def point_in_roi(x: float, y: float, roi: Tuple[float, float, float, float]) -> bool:
    """Check if point (x, y) falls inside (x1, y1, x2, y2) region of interest."""
    x1, y1, x2, y2 = roi
    return x1 <= x <= x2 and y1 <= y <= y2

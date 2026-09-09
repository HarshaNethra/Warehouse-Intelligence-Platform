"""
Unit tests for behaviour_engine/geometry.py.
"""

import math
import unittest
from behaviour_engine.geometry import (
    box_area,
    box_intersection,
    box_iou,
    center_distance,
    horizontal_overlap_ratio,
    is_near_floor,
    object_above_object,
    object_below_object,
    overlap_ratio,
    point_in_roi,
    to_center,
    to_corners,
    vertical_overlap_ratio,
)


class TestGeometry(unittest.TestCase):

    def test_corners_and_center_conversion(self):
        cx, cy, w, h = 100.0, 200.0, 50.0, 80.0
        x1, y1, x2, y2 = to_corners(cx, cy, w, h)
        self.assertEqual((x1, y1, x2, y2), (75.0, 160.0, 125.0, 240.0))

        rcx, rcy, rw, rh = to_center(x1, y1, x2, y2)
        self.assertAlmostEqual(rcx, cx)
        self.assertAlmostEqual(rcy, cy)
        self.assertAlmostEqual(rw, w)
        self.assertAlmostEqual(rh, h)

    def test_box_area(self):
        self.assertEqual(box_area(10.0, 20.0), 200.0)
        self.assertEqual(box_area(0.0, 20.0), 0.0)
        self.assertEqual(box_area(-5.0, 20.0), 0.0)

    def test_center_distance(self):
        dist = center_distance(0.0, 0.0, 3.0, 4.0)
        self.assertAlmostEqual(dist, 5.0)

    def test_box_intersection_and_iou(self):
        box_a = (100.0, 100.0, 50.0, 50.0)  # [75..125, 75..125]
        box_b = (100.0, 100.0, 50.0, 50.0)  # Identical

        self.assertAlmostEqual(box_iou(box_a, box_b), 1.0)
        self.assertAlmostEqual(overlap_ratio(box_a, box_b), 1.0)

        # Disjoint boxes
        box_c = (200.0, 200.0, 50.0, 50.0)
        self.assertEqual(box_intersection(box_a, box_c), 0.0)
        self.assertEqual(box_iou(box_a, box_c), 0.0)

        # Partial overlap: shifted by 25px horizontally
        box_d = (125.0, 100.0, 50.0, 50.0)  # [100..150, 75..125], inter w=25, h=50 -> area=1250
        # union = 2500 + 2500 - 1250 = 3750, IoU = 1250 / 3750 = 1/3
        self.assertAlmostEqual(box_iou(box_a, box_d), 1.0 / 3.0)

    def test_overlap_ratios(self):
        box_a = (100.0, 100.0, 100.0, 100.0)
        box_b = (100.0, 100.0, 50.0, 50.0)  # Fully inside box_a
        self.assertAlmostEqual(overlap_ratio(box_b, box_a), 1.0)
        self.assertAlmostEqual(overlap_ratio(box_a, box_b), 0.25)
        self.assertAlmostEqual(horizontal_overlap_ratio(box_a, box_b), 1.0)
        self.assertAlmostEqual(vertical_overlap_ratio(box_a, box_b), 1.0)

    def test_object_above_and_below(self):
        # Lower box on floor: center=(500, 550), w=100, h=100 -> [450..550, 500..600]
        lower_box = (500.0, 550.0, 100.0, 100.0)
        # Upper box stacked directly on top: center=(500, 450), w=100, h=100 -> [450..550, 400..500]
        upper_box = (500.0, 450.0, 100.0, 100.0)

        self.assertTrue(object_above_object(upper_box, lower_box))
        self.assertTrue(object_below_object(lower_box, upper_box))
        self.assertFalse(object_above_object(lower_box, upper_box))

        # Displaced horizontally beyond threshold
        sideways_box = (700.0, 450.0, 100.0, 100.0)
        self.assertFalse(object_above_object(sideways_box, lower_box))

    def test_is_near_floor(self):
        # Frame height = 720, floor ratio = 0.60 -> floor starts at 432 px
        # Object with center y=500, h=100 -> bottom=550 px >= 432 -> True
        self.assertTrue(is_near_floor(500.0, 100.0, frame_height=720, floor_y_ratio=0.60))
        # Object with center y=200, h=50 -> bottom=225 px < 432 -> False
        self.assertFalse(is_near_floor(200.0, 50.0, frame_height=720, floor_y_ratio=0.60))

    def test_point_in_roi(self):
        roi = (100.0, 200.0, 400.0, 500.0)
        self.assertTrue(point_in_roi(150.0, 250.0, roi))
        self.assertFalse(point_in_roi(50.0, 250.0, roi))
        self.assertFalse(point_in_roi(150.0, 600.0, roi))


if __name__ == "__main__":
    unittest.main()

"""
Unit tests for behaviour_engine/temporal.py.
"""

import unittest
from behaviour_engine.base_rule import BehaviourCandidate
from behaviour_engine.motion import TrackPoint
from behaviour_engine.temporal import (
    DebounceManager,
    check_persistence,
    merge_overlapping_candidates,
    post_event_stationary,
    resolve_incident_overlaps,
    sliding_windows,
)


class TestTemporal(unittest.TestCase):

    def test_sliding_windows(self):
        pts = [TrackPoint(frame=i, x=float(i), y=0.0, width=10.0, height=10.0) for i in range(10)]
        windows = list(sliding_windows(pts, window_size=5, step=2))
        # i=0, 2, 4 -> 3 windows of length 5
        self.assertEqual(len(windows), 3)
        self.assertEqual(len(windows[0]), 5)
        self.assertEqual(windows[0][0].frame, 0)
        self.assertEqual(windows[1][0].frame, 2)

    def test_check_persistence(self):
        pts = [TrackPoint(frame=i, x=float(i * 10), y=0.0, width=10.0, height=10.0) for i in range(5)]
        # Predicate: consecutive x increases
        persists = check_persistence(pts, lambda p1, p2: p2.x > p1.x, min_consecutive_frames=4)
        self.assertTrue(persists)

        does_not_persist = check_persistence(pts, lambda p1, p2: p2.x < p1.x, min_consecutive_frames=2)
        self.assertFalse(does_not_persist)

    def test_debounce_manager(self):
        debounce = DebounceManager(default_cooldown_frames=30)
        self.assertTrue(debounce.can_trigger("drop_rule", 1, current_frame=10))

        debounce.register_trigger("drop_rule", 1, current_frame=10)
        # 15 frames later: within cooldown -> False
        self.assertFalse(debounce.can_trigger("drop_rule", 1, current_frame=25))
        # Different object -> True
        self.assertTrue(debounce.can_trigger("drop_rule", 2, current_frame=25))
        # 35 frames later: cooldown elapsed -> True
        self.assertTrue(debounce.can_trigger("drop_rule", 1, current_frame=45))

    def test_merge_overlapping_candidates(self):
        c1 = BehaviourCandidate(
            rule_name="drag_rule",
            behaviour_type="product_dragged",
            object_id=1,
            start_frame=10,
            end_frame=30,
            confidence=0.70,
            primary_measurement=100.0,
            evidence={"dist": 100},
            description="drag 1",
        )
        c2 = BehaviourCandidate(
            rule_name="drag_rule",
            behaviour_type="product_dragged",
            object_id=1,
            start_frame=35,
            end_frame=60,
            confidence=0.85,
            primary_measurement=150.0,
            evidence={"speed": 50},
            description="drag 2",
        )
        # Non-overlapping candidate for object 2
        c3 = BehaviourCandidate(
            rule_name="drag_rule",
            behaviour_type="product_dragged",
            object_id=2,
            start_frame=10,
            end_frame=25,
            confidence=0.80,
            primary_measurement=80.0,
            evidence={},
            description="drag obj2",
        )

        merged = merge_overlapping_candidates([c1, c2, c3], overlap_frame_threshold=20)
        # c1 and c2 should merge into one with start=10, end=60, confidence=0.85
        self.assertEqual(len(merged), 2)
        merged_c1 = [m for m in merged if m.object_id == 1][0]
        self.assertEqual(merged_c1.start_frame, 10)
        self.assertEqual(merged_c1.end_frame, 60)
        self.assertEqual(merged_c1.confidence, 0.85)

    def test_subsume_overlapping_rough_handling(self):
        """Generic rough_handling overlapping a specific throw should be subsumed."""
        throw = BehaviourCandidate(
            rule_name="throw_rule",
            behaviour_type="product_thrown",
            object_id=10,
            start_frame=10,
            end_frame=35,
            confidence=0.90,
            primary_measurement=150.0,
            evidence={"flight_distance_px": 150.0},
            description="thrown carton",
        )
        rough = BehaviourCandidate(
            rule_name="rough_handling_rule",
            behaviour_type="rough_handling",
            object_id=10,
            start_frame=12,
            end_frame=28,
            confidence=0.80,
            primary_measurement=18000.0,
            evidence={"max_acceleration_px_s2": 18000.0},
            description="rough acceleration",
        )
        resolved = resolve_incident_overlaps([throw, rough], fps=30.0)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].behaviour_type, "product_thrown")
        self.assertEqual(resolved[0].evidence["max_acceleration_px_s2"], 18000.0)
        self.assertTrue(resolved[0].evidence.get("subsumed_rough_handling"))

    def test_preserve_standalone_rough_handling(self):
        """Standalone rough_handling without specific action must be preserved."""
        rough = BehaviourCandidate(
            rule_name="rough_handling_rule",
            behaviour_type="rough_handling",
            object_id=20,
            start_frame=10,
            end_frame=30,
            confidence=0.75,
            primary_measurement=12000.0,
            evidence={"max_acceleration_px_s2": 12000.0},
            description="standalone rough",
        )
        resolved = resolve_incident_overlaps([rough], fps=30.0)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].behaviour_type, "rough_handling")

    def test_continuous_throw_landing_drop_unified(self):
        """A continuous throw ending in landing drop should unify into product_thrown."""
        throw = BehaviourCandidate(
            rule_name="throw_rule",
            behaviour_type="product_thrown",
            object_id=30,
            start_frame=10,
            end_frame=25,
            confidence=0.85,
            primary_measurement=120.0,
            evidence={"flight_distance_px": 120.0},
            description="thrown carton",
        )
        drop = BehaviourCandidate(
            rule_name="drop_rule",
            behaviour_type="product_dropped",
            object_id=30,
            start_frame=23,
            end_frame=32,
            confidence=0.88,
            primary_measurement=85.0,
            evidence={"drop_height_px": 85.0, "max_downward_speed_px_s": 220.0},
            description="landing drop",
        )
        resolved = resolve_incident_overlaps([throw, drop], fps=30.0)
        self.assertEqual(len(resolved), 1)
        self.assertEqual(resolved[0].behaviour_type, "product_thrown")
        self.assertEqual(resolved[0].start_frame, 10)
        self.assertEqual(resolved[0].end_frame, 32)
        self.assertIn("landing_drop", resolved[0].evidence)
        self.assertEqual(resolved[0].evidence["landing_drop"]["impact_drop_height_px"], 85.0)

    def test_distinct_sequential_throw_and_drop_preserved(self):
        """Distinct sequential drop followed by a later throw (>0.40s gap) must both be preserved."""
        drop = BehaviourCandidate(
            rule_name="drop_rule",
            behaviour_type="product_dropped",
            object_id=40,
            start_frame=10,
            end_frame=20,
            confidence=0.85,
            primary_measurement=70.0,
            evidence={"drop_height_px": 70.0},
            description="initial drop",
        )
        throw = BehaviourCandidate(
            rule_name="throw_rule",
            behaviour_type="product_thrown",
            object_id=40,
            start_frame=40,
            end_frame=60,
            confidence=0.90,
            primary_measurement=140.0,
            evidence={"flight_distance_px": 140.0},
            description="later throw",
        )
        resolved = resolve_incident_overlaps([drop, throw], fps=30.0)
        self.assertEqual(len(resolved), 2)
        types = [r.behaviour_type for r in resolved]
        self.assertIn("product_dropped", types)
        self.assertIn("product_thrown", types)

    def test_sequential_throw_and_floor_drag_preserved(self):
        """A throw followed by dragging carton across the floor must preserve both distinct events."""
        throw = BehaviourCandidate(
            rule_name="throw_rule",
            behaviour_type="product_thrown",
            object_id=50,
            start_frame=1,
            end_frame=27,
            confidence=0.95,
            primary_measurement=95.0,
            evidence={"flight_distance_px": 95.0},
            description="toss into floor",
        )
        drag = BehaviourCandidate(
            rule_name="drag_rule",
            behaviour_type="product_dragged",
            object_id=50,
            start_frame=25,
            end_frame=66,
            confidence=0.95,
            primary_measurement=98.0,
            evidence={"horizontal_displacement_px": 98.0},
            description="dragged across floor",
        )
        resolved = resolve_incident_overlaps([throw, drag], fps=30.0)
        self.assertEqual(len(resolved), 2)
        types = [r.behaviour_type for r in resolved]
        self.assertIn("product_thrown", types)
        self.assertIn("product_dragged", types)


if __name__ == "__main__":
    unittest.main()

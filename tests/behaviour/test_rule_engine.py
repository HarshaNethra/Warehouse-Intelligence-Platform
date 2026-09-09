"""
Unit tests for behaviour_engine/rule_engine.py and event_builder.py.
"""

import unittest
import pandas as pd
from behaviour_engine.event_builder import build_event, build_events_from_candidates
from behaviour_engine.rule_engine import RuleEngine


class TestRuleEngine(unittest.TestCase):

    def setUp(self):
        self.engine = RuleEngine()

    def test_parse_trajectory_dataframe(self):
        data = {
            "frame": [0, 1, 0, 1],
            "object_id": [1, 1, 2, 2],
            "class": ["carton", "carton", "person", "person"],
            "x": [100.0, 110.0, 200.0, 205.0],
            "y": [300.0, 305.0, 400.0, 400.0],
            "width": [50.0, 50.0, 60.0, 60.0],
            "height": [50.0, 50.0, 150.0, 150.0],
        }
        df = pd.DataFrame(data)
        tracks = self.engine.parse_trajectory_csv(df)

        self.assertIn(1, tracks)
        self.assertIn(2, tracks)
        self.assertEqual(len(tracks[1]), 2)
        self.assertEqual(tracks[1][0].frame, 0)
        self.assertEqual(tracks[1][1].frame, 1)

    def test_event_builder(self):
        # Create a mock candidate
        from behaviour_engine.base_rule import BehaviourCandidate
        cand = BehaviourCandidate(
            rule_name="drop_rule",
            behaviour_type="product_dropped",
            object_id=5,
            start_frame=30,
            end_frame=45,
            confidence=0.88,
            primary_measurement=120.0,
            evidence={"drop_height_px": 120.0},
            description="Mock drop",
        )

        event = build_event(cand, video_id="test_video", event_index=1, fps=30.0, risk_score=75, risk_level="high")
        self.assertEqual(event["event_id"], "EVT-TEST_V-001")
        self.assertEqual(event["timestamp"], 1.0)
        self.assertEqual(event["duration"], 0.5)
        self.assertEqual(event["object_id"], 5)
        self.assertEqual(event["behaviour"], "product_dropped")
        self.assertEqual(event["risk_score"], 75)
        self.assertEqual(event["risk_level"], "high")
        self.assertEqual(event["evidence_frame"], 37)


if __name__ == "__main__":
    unittest.main()

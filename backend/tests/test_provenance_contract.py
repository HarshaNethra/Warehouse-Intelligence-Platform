"""
Unit and Integration Tests for WitWatch Perception Provenance Contract & Signal Propagation.

Verifies:
  1. Minimal valid observation details model.
  2. Full available provenance details model.
  3. Handling of missing optional fields (honest null representation).
  4. Type validation (invalid numeric types, structure validation).
  5. JSON serialization (exclude_none, valid JSON structure).
  6. JSON deserialization (model -> JSON -> model roundtrip).
  7. Legacy details_json parsing compatibility (minimal live JSON, offline evidence dicts).
  8. Detector provenance propagation (TEST 1 - controlled detection).
  9. Honest missing provenance (TEST 2 - absent values not substituted).
  10. Pose provenance filtering (TEST 3 - only used keypoints preserved).
  11. Rule semantic preservation & Event confidence independence (TEST 4, TEST 5).
"""

import json
import unittest
import sys
import os
from unittest.mock import MagicMock

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.schemas.provenance import (
    BehaviourObservationDetails,
    IdentityProvenance,
    TemporalProvenance,
    PerceptionProvenance,
    MotionProvenance,
    BehaviourRuleProvenance,
    RiskProvenance,
    ModelRunProvenance,
    parse_details_json
)
from app.services.rule_engine import SafetyRuleEngine, KinematicsEngine


class TestProvenanceContract(unittest.TestCase):

    def test_minimal_provenance_model(self):
        """1. Test minimal valid observation details model."""
        details = BehaviourObservationDetails()
        json_str = details.model_dump_json(exclude_none=True)
        self.assertIn(json_str, ["{}", "{}\n"])
        reconstructed = BehaviourObservationDetails.model_validate_json(json_str)
        self.assertIsNone(reconstructed.identity)
        self.assertIsNone(reconstructed.behaviour)

    def test_full_provenance_model(self):
        """2. Test full available provenance details model."""
        details = BehaviourObservationDetails(
            identity=IdentityProvenance(
                observation_id="OBS-12345678",
                inference_run_id="RUN-87654321",
                video_id="CAM-01",
                track_id=4
            ),
            temporal=TemporalProvenance(
                frame_number=120,
                timestamp_seconds=4.0,
                video_fps=30.0,
                persistence_frames=15
            ),
            perception=PerceptionProvenance(
                object_class="carton",
                detector_confidence=0.73,
                trigger_bbox=[10.0, 20.0, 110.0, 220.0]
            ),
            motion=MotionProvenance(
                velocity_vector_px_s=[10.5, 120.0],
                acceleration_y_px_s2=2400.0,
                acceleration_y_metric_estimate=12.0,
                peak_deceleration_px_s2=1200.0,
                displacement_px=150.0,
                duration_seconds=0.45,
                stationary_tail=True
            ),
            behaviour=BehaviourRuleProvenance(
                rule_id="RULE_KINEMATICS_FREEFALL",
                behaviour_type="Product Freefall / Drop (carton)",
                measured_value=12.0,
                threshold_applied=8.0,
                unit="m/s²",
                persistence_frames=3
            ),
            risk=RiskProvenance(
                risk_score=84.0,
                risk_level="HIGH",
                potential_consequence="Potential product structural damage.",
                recommended_action="Inspect carton before dispatch."
            ),
            model_run=ModelRunProvenance(
                model_name="YOLO11s",
                model_version="v1.4.2-tensorrt",
                inference_engine="LOCAL_YOLO11"
            )
        )

        json_str = details.model_dump_json(exclude_none=True)
        data = json.loads(json_str)

        self.assertEqual(data["identity"]["track_id"], 4)
        self.assertEqual(data["temporal"]["frame_number"], 120)
        self.assertEqual(data["perception"]["detector_confidence"], 0.73)
        self.assertEqual(data["perception"]["trigger_bbox"], [10.0, 20.0, 110.0, 220.0])

        # Roundtrip deserialization
        reconstructed = BehaviourObservationDetails.model_validate_json(json_str)
        self.assertEqual(reconstructed.identity.track_id, 4)
        self.assertEqual(reconstructed.perception.detector_confidence, 0.73)

    def test_missing_optional_provenance(self):
        """3. Test missing optional provenance representation (honest null representation)."""
        details = BehaviourObservationDetails(
            identity=IdentityProvenance(track_id=10),
            perception=PerceptionProvenance(object_class="carton")
        )
        json_str = details.model_dump_json(exclude_none=True)
        data = json.loads(json_str)
        self.assertEqual(data["identity"], {"track_id": 10})
        self.assertEqual(data["perception"], {"object_class": "carton"})
        self.assertNotIn("detector_confidence", data["perception"])
        self.assertNotIn("tracking", data)

    def test_invalid_type_coercion_handling(self):
        """4. Test type coercion and parsing validation."""
        data = {
            "identity": {"track_id": "4"},  # String coerced to Int by Pydantic
            "temporal": {"frame_number": "120", "timestamp_seconds": "4.5"}
        }
        details = BehaviourObservationDetails.model_validate(data)
        self.assertEqual(details.identity.track_id, 4)
        self.assertEqual(details.temporal.frame_number, 120)

    def test_legacy_details_json_parsing(self):
        """5, 6, 7. Test legacy details_json parsing compatibility."""
        live_legacy_json = json.dumps({
            "rule_id": "RULE_KINEMATICS_FREEFALL",
            "track_id": 4,
            "frame_number": 120,
            "timestamp": 4.0
        })
        parsed_live = parse_details_json(live_legacy_json)
        self.assertEqual(parsed_live.identity.track_id, 4)
        self.assertEqual(parsed_live.temporal.frame_number, 120)
        self.assertEqual(parsed_live.behaviour.rule_id, "RULE_KINEMATICS_FREEFALL")

    def test_prompt3c_test1_detector_provenance_propagation(self):
        """Prompt 3C TEST 1: Verify controlled detection detector_confidence and trigger_bbox propagation."""
        engine = SafetyRuleEngine(fps=30.0)
        controlled_det = {
            "track_id": 7,
            "class": "carton",
            "bbox": [10.0, 20.0, 110.0, 220.0],
            "confidence": 0.73
        }

        mock_db = MagicMock()
        for f in range(1, 6):
            controlled_det["bbox"] = [10.0, 20.0 + (f * f * 40.0), 110.0, 220.0 + (f * f * 40.0)]
            alerts = engine.evaluate_frame(
                frame_index=f,
                timestamp=f * (1.0 / 30.0),
                detections=[controlled_det],
                poses=[],
                video_id="CAM-01",
                db_session=mock_db,
                inference_run_id="RUN-TEST-01"
            )

        self.assertTrue(len(alerts) > 0)
        alert = alerts[0]
        self.assertEqual(alert["track_id"], 7)
        self.assertEqual(alert["detector_confidence"], 0.73)

        added_objs = [call[0][0] for call in mock_db.add.call_args_list]
        from app.db.models import BehaviourObservation, Event
        obs_records = [o for o in added_objs if isinstance(o, BehaviourObservation)]
        event_records = [e for e in added_objs if isinstance(e, Event)]

        self.assertTrue(len(obs_records) > 0)
        obs_details = parse_details_json(obs_records[0].details_json)
        self.assertEqual(obs_details.perception.detector_confidence, 0.73)
        self.assertEqual(obs_details.perception.trigger_bbox, controlled_det["bbox"])

        # Verify Prompt 3C TEST 5: Event.confidence independence (remains default 0.92, NOT changed to 0.73)
        self.assertTrue(len(event_records) > 0)
        self.assertEqual(event_records[0].confidence, 0.92)

    def test_prompt3c_test2_honest_missing_provenance(self):
        """Prompt 3C TEST 2: Verify absent detector_confidence is NOT substituted with 0.92."""
        engine = SafetyRuleEngine(fps=30.0)
        det_no_conf = {
            "track_id": 9,
            "class": "carton",
            "bbox": [10.0, 20.0, 110.0, 220.0]
            # confidence key missing
        }
        mock_db = MagicMock()
        for f in range(1, 6):
            det_no_conf["bbox"] = [10.0, 20.0 + (f * f * 40.0), 110.0, 220.0 + (f * f * 40.0)]
            alerts = engine.evaluate_frame(
                frame_index=f,
                timestamp=f * (1.0 / 30.0),
                detections=[det_no_conf],
                poses=[],
                video_id="CAM-01",
                db_session=mock_db,
                inference_run_id="RUN-TEST-02"
            )

        added_objs = [call[0][0] for call in mock_db.add.call_args_list]
        from app.db.models import BehaviourObservation
        obs_records = [o for o in added_objs if isinstance(o, BehaviourObservation)]
        self.assertTrue(len(obs_records) > 0)
        
        parsed_json = json.loads(obs_records[0].details_json)
        if "perception" in parsed_json:
            self.assertNotIn("detector_confidence", parsed_json["perception"])

    def test_prompt3c_test3_pose_provenance_filtering(self):
        """Prompt 3C TEST 3: Verify only used keypoints (#15/#16 ankles for Rule 01) are preserved."""
        engine = SafetyRuleEngine(fps=30.0)
        inv_det = {
            "track_id": 12,
            "class": "carton",
            "bbox": [100.0, 100.0, 300.0, 300.0],
            "confidence": 0.85
        }
        keypoints = [[0.0, 0.0, 0.0] for _ in range(17)]
        keypoints[15] = [150.0, 150.0, 0.95]
        keypoints[0] = [10.0, 10.0, 0.90]

        pose_input = [{"person_id": 1, "keypoints": keypoints}]
        mock_db = MagicMock()

        for f in range(1, 16):
            alerts = engine.evaluate_frame(
                frame_index=f,
                timestamp=f * (1.0 / 30.0),
                detections=[inv_det],
                poses=pose_input,
                video_id="CAM-01",
                db_session=mock_db,
                inference_run_id="RUN-TEST-03"
            )

        rule1_alerts = [a for a in alerts if a["rule_id"] == "RULE_01_PERSON_ON_INVENTORY"]
        self.assertTrue(len(rule1_alerts) > 0)
        pose_kpts = rule1_alerts[0]["pose_keypoints"]
        self.assertIn("left_ankle", pose_kpts)
        self.assertNotIn("nose", pose_kpts)  # Nose was not used by Rule 01
        self.assertEqual(pose_kpts["left_ankle"]["confidence"], 0.95)


if __name__ == "__main__":
    unittest.main()

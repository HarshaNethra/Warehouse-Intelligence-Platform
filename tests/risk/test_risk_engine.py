"""
Unit tests for the Risk Engine.
Tests category boundaries, clamping, multi-factor calculations, explanations, and pipeline assembly.
"""

import unittest
from behaviour_engine.base_rule import BehaviourCandidate
from risk_engine.classifier import classify_risk
from risk_engine.config import DEFAULT_RISK_CONFIG
from risk_engine.explanation import generate_explanation
from risk_engine.factors import (
    calculate_duration_factor,
    calculate_frequency_factor,
    calculate_height_factor,
    calculate_impact_factor,
    calculate_location_factor,
    extract_factors_from_evidence,
)
from risk_engine.pipeline import score_and_build_events
from risk_engine.scorer import calculate_risk_score
from risk_engine.severity import get_base_severity


class TestRiskEngine(unittest.TestCase):

    def test_risk_category_boundaries(self):
        # Explicit test of boundary values specified in PRD
        self.assertEqual(classify_risk(0), "low")
        self.assertEqual(classify_risk(29), "low")
        self.assertEqual(classify_risk(30), "medium")
        self.assertEqual(classify_risk(59), "medium")
        self.assertEqual(classify_risk(60), "high")
        self.assertEqual(classify_risk(84), "high")
        self.assertEqual(classify_risk(85), "critical")
        self.assertEqual(classify_risk(100), "critical")

        # Clamping behavior on out-of-range inputs
        self.assertEqual(classify_risk(-10), "low")
        self.assertEqual(classify_risk(150), "critical")

    def test_base_severity_lookup(self):
        self.assertEqual(get_base_severity("stepping_on_cartons"), 65.0)
        self.assertEqual(get_base_severity("product_thrown"), 60.0)
        self.assertEqual(get_base_severity("product_dropped"), 50.0)
        self.assertEqual(get_base_severity("product_dragged"), 35.0)
        self.assertEqual(get_base_severity("unknown_behaviour"), 35.0)

    def test_factor_calculations_and_bounds(self):
        # Height factor: 0 at <=60px, 30 at >=300px
        self.assertEqual(calculate_height_factor(30.0), 0.0)
        self.assertEqual(calculate_height_factor(300.0), 30.0)
        self.assertEqual(calculate_height_factor(500.0), 30.0)  # Capped at 30

        # Impact factor
        self.assertEqual(calculate_impact_factor(200.0), 0.0)
        self.assertEqual(calculate_impact_factor(1200.0), 30.0)
        self.assertEqual(calculate_impact_factor(2000.0), 30.0)

        # Duration factor
        self.assertEqual(calculate_duration_factor(0.5), 0.0)
        self.assertEqual(calculate_duration_factor(6.0), 30.0)

        # Frequency factor
        self.assertEqual(calculate_frequency_factor(1), 0.0)
        self.assertEqual(calculate_frequency_factor(5), 30.0)

        # Location factor
        self.assertEqual(calculate_location_factor("dock_edge_ledge"), 25.0)
        self.assertEqual(calculate_location_factor("wet_floor_slip_zone"), 20.0)
        self.assertEqual(calculate_location_factor(""), 0.0)

    def test_risk_scorer_clamping(self):
        # All max factors on stepping_on_cartons (base=65)
        max_factors = {
            "impact_factor": 30.0,
            "height_factor": 30.0,
            "duration_factor": 30.0,
            "frequency_factor": 30.0,
            "location_factor": 30.0,
        }
        score = calculate_risk_score("stepping_on_cartons", max_factors)
        self.assertLessEqual(score, 100)
        self.assertGreaterEqual(score, 85)

        # Empty factors (only base severity)
        score_base = calculate_risk_score("product_dropped", {})
        self.assertEqual(score_base, 50)

    def test_explanation_generation(self):
        factors = {"impact_factor": 25.0, "height_factor": 20.0}
        evidence = {"max_deceleration_px_s2": 1050.0, "drop_height_px": 220.0}
        reason, action = generate_explanation("product_dropped", "high", 72, factors, evidence)

        self.assertIn("HIGH RISK", reason)
        self.assertIn("product dropped", reason)
        self.assertIn("inspect package seals", action.lower())
        # Ensure no claim of confirmed damage
        self.assertNotIn("confirmed damage", reason.lower())
        self.assertIn("potential handling risk", reason.lower())

    def test_pipeline_score_and_build_events(self):
        c1 = BehaviourCandidate(
            rule_name="drop_rule",
            behaviour_type="product_dropped",
            object_id=3,
            start_frame=60,
            end_frame=75,
            confidence=0.85,
            primary_measurement=150.0,
            evidence={"drop_height_px": 150.0, "max_deceleration_px_s2": 600.0},
            description="Drop candidate",
        )

        events = score_and_build_events([c1], video_id="Rolling and dropping carton", fps=30.0)
        self.assertEqual(len(events), 1)
        evt = events[0]
        self.assertEqual(evt["video_id"], "Rolling and dropping carton")
        self.assertEqual(evt["behaviour"], "product_dropped")
        self.assertGreaterEqual(evt["risk_score"], 50)
        self.assertIn("risk_factors", evt["evidence"])


if __name__ == "__main__":
    unittest.main()

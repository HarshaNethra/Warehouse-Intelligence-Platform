import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.services.rule_engine import SafetyRuleEngine

def test_rule_engine_mutation_normal_trajectory():
    """MUTATION TEST 1: Normal box placement trajectory produces NO drop event."""
    engine = SafetyRuleEngine(fps=30.0)
    
    # 5 frames of gradual horizontal placement (no vertical acceleration)
    detections_f1 = [{"track_id": 201, "class": "carton", "bbox": [100.0, 500.0, 200.0, 600.0], "confidence": 0.95}]
    detections_f2 = [{"track_id": 201, "class": "carton", "bbox": [105.0, 500.0, 205.0, 600.0], "confidence": 0.95}]
    detections_f3 = [{"track_id": 201, "class": "carton", "bbox": [110.0, 500.0, 210.0, 600.0], "confidence": 0.95}]
    
    alerts1 = engine.evaluate_frame(1, 0.033, detections_f1, [])
    alerts2 = engine.evaluate_frame(2, 0.066, detections_f2, [])
    alerts3 = engine.evaluate_frame(3, 0.099, detections_f3, [])
    
    drop_alerts = [a for a in (alerts1 + alerts2 + alerts3) if a.get("rule_id") == "RULE_KINEMATICS_FREEFALL"]
    assert len(drop_alerts) == 0, "Normal trajectory must NOT produce drop alert!"

def test_rule_engine_mutation_freefall_trajectory():
    """MUTATION TEST 2: Accelerated vertical drop trajectory produces FREEFALL_DETECTED alert."""
    engine = SafetyRuleEngine(fps=30.0)
    
    # 3 frames of accelerating downward drop
    # y1 = 100, y2 = 110, y3 = 135 -> acceleration_y = 67.5 m/s^2 > 8.0 m/s^2 threshold
    detections_f1 = [{"track_id": 202, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0], "confidence": 0.95}]
    detections_f2 = [{"track_id": 202, "class": "carton", "bbox": [100.0, 110.0, 200.0, 210.0], "confidence": 0.95}]
    detections_f3 = [{"track_id": 202, "class": "carton", "bbox": [100.0, 135.0, 200.0, 235.0], "confidence": 0.95}]
    
    engine.evaluate_frame(1, 0.033, detections_f1, [])
    engine.evaluate_frame(2, 0.066, detections_f2, [])
    alerts3 = engine.evaluate_frame(3, 0.099, detections_f3, [])
    
    drop_alerts = [a for a in alerts3 if a.get("rule_id") == "RULE_KINEMATICS_FREEFALL"]
    assert len(drop_alerts) == 1, "Freefall trajectory MUST produce drop alert!"
    assert drop_alerts[0]["behaviour"] == "Product Freefall / Drop (carton)"
    assert drop_alerts[0]["severity"] == "CRITICAL"

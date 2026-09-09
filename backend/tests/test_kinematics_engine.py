import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.services.rule_engine import KinematicsEngine, TrackedObject

def test_kinematics_spatial_scaling():
    """Verify pixel acceleration px/s^2 is correctly scaled to metric acceleration m/s^2."""
    engine = KinematicsEngine(fps=30.0, meters_per_pixel=0.005) # 5mm / px
    
    # Track 101 moving vertically with acceleration
    # Frame 1: y = 100.0 (vy = 0)
    # Frame 2: y = 110.0 (dy = 10px, dt = 0.0333s -> vy = 300 px/s)
    # Frame 3: y = 135.0 (dy = 25px, dt = 0.0333s -> vy = 750 px/s)
    # Acceleration: (750 - 300) / 0.0333 = 13500 px/s^2
    # Metric Acceleration: 13500 * 0.005 = 67.5 m/s^2
    
    t0 = 0.0
    engine.update_tracks([{"track_id": 101, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0]}], t0)
    engine.update_tracks([{"track_id": 101, "class": "carton", "bbox": [100.0, 110.0, 200.0, 210.0]}], t0 + 0.0333)
    alerts = engine.update_tracks([{"track_id": 101, "class": "carton", "bbox": [100.0, 135.0, 200.0, 235.0]}], t0 + 0.0666)
    
    assert len(alerts) == 1
    alert = alerts[0]
    assert alert["rule"] == "FREEFALL_DETECTED"
    assert alert["object_class"] == "carton"
    assert pytest.approx(alert["acceleration_y"], 0.1) == 67.5
    assert pytest.approx(alert["acceleration_y_px"], 1.0) == 13500.0
    assert alert["severity"] == "CRITICAL"

def test_kinematics_normal_horizontal_movement_no_alert():
    """Verify normal horizontal box placement triggers NO freefall alert."""
    engine = KinematicsEngine(fps=30.0, meters_per_pixel=0.005)
    
    t0 = 0.0
    engine.update_tracks([{"track_id": 102, "class": "carton", "bbox": [100.0, 100.0, 200.0, 200.0]}], t0)
    engine.update_tracks([{"track_id": 102, "class": "carton", "bbox": [105.0, 100.0, 205.0, 200.0]}], t0 + 0.0333)
    alerts = engine.update_tracks([{"track_id": 102, "class": "carton", "bbox": [110.0, 100.0, 210.0, 200.0]}], t0 + 0.0666)
    
    assert len(alerts) == 0

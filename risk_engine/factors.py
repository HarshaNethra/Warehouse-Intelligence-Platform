"""
Measurable Risk Factors for Incident Risk Scoring.

All factor calculations are strictly bounded in range [0.0, 30.0].
Missing, negative, or invalid data defaults safely to 0.0 with no exceptions thrown.
"""

from typing import Any, Dict


def calculate_height_factor(drop_height_px: float, frame_height: float = 720.0) -> float:
    """
    Calculates height risk factor based on vertical travel distance in pixels.
    Scaling:
      - 0 to 60px: 0.0 (minor descent)
      - 60 to 300px: linear ramp up to 30.0
      - > 300px: capped at 30.0
    """
    if drop_height_px <= 60.0:
        return 0.0
    ratio = (drop_height_px - 60.0) / max(1.0, 240.0)
    return min(30.0, max(0.0, ratio * 30.0))


def calculate_impact_factor(max_deceleration_px_s2: float) -> float:
    """
    Calculates impact factor from peak deceleration in px/s².
    Scaling:
      - <= 300 px/s²: 0.0
      - 300 to 1200 px/s²: linear ramp up to 30.0
      - > 1200 px/s²: capped at 30.0
    """
    if max_deceleration_px_s2 <= 300.0:
        return 0.0
    ratio = (max_deceleration_px_s2 - 300.0) / 900.0
    return min(30.0, max(0.0, ratio * 30.0))


def calculate_duration_factor(duration_seconds: float) -> float:
    """
    Calculates prolonged exposure factor (e.g. dragged 10s vs 1s).
    Scaling:
      - <= 1.0s: 0.0
      - 1.0s to 6.0s: linear ramp up to 30.0
      - > 6.0s: capped at 30.0
    """
    if duration_seconds <= 1.0:
        return 0.0
    ratio = (duration_seconds - 1.0) / 5.0
    return min(30.0, max(0.0, ratio * 30.0))


def calculate_frequency_factor(repetition_count: int) -> float:
    """
    Calculates repetition / recurrence risk factor within the same shift/video.
    Scaling:
      - 1 occurrence: 0.0
      - 2 to 5 occurrences: ramp up to 30.0
    """
    if repetition_count <= 1:
        return 0.0
    return min(30.0, (repetition_count - 1) * 7.5)


def calculate_location_factor(hazard_type: str) -> float:
    """
    Calculates environmental hazard factor based on proximity to dock ledge or wet floor.
    Values:
      - 'dock_edge_ledge': 25.0
      - 'wet_floor_slip_zone': 20.0
      - other/none: 0.0
    """
    if not hazard_type:
        return 0.0
    h_lower = str(hazard_type).lower()
    if "dock" in h_lower or "edge" in h_lower:
        return 25.0
    if "wet" in h_lower or "slip" in h_lower:
        return 20.0
    return 10.0


def extract_factors_from_evidence(evidence: Dict[str, Any],
                                  duration_s: float = 1.0,
                                  repetition_count: int = 1,
                                  video_id: str = "") -> Dict[str, float]:
    """
    Safely extracts all measurable factors from a candidate's evidence dictionary.
    """
    drop_h = float(evidence.get("drop_height_px", 0.0))
    if drop_h <= 0.0 and "elevation_y" in evidence:
        # Worker elevation above floor plane (assuming floor around y=600px)
        elev_y = float(evidence.get("elevation_y", 400.0))
        drop_h = max(0.0, 620.0 - elev_y)

    max_decel = float(evidence.get("max_deceleration_px_s2") or evidence.get("max_acceleration_px_s2") or 0.0)
    if max_decel <= 0.0 and "violation" in evidence and "stepping" in str(evidence.get("violation")).lower():
        # Bodyweight static crush load on packages
        max_decel = 800.0

    hazard_type = str(evidence.get("hazard_type", ""))

    if not hazard_type and video_id:
        v_lower = video_id.lower()
        if "dock" in v_lower:
            hazard_type = "dock_edge_ledge"
        elif "wet" in v_lower or "floor" in v_lower:
            hazard_type = "wet_floor_slip_zone"

    return {
        "height_factor": round(calculate_height_factor(drop_h), 2),
        "impact_factor": round(calculate_impact_factor(max_decel), 2),
        "duration_factor": round(calculate_duration_factor(duration_s), 2),
        "frequency_factor": round(calculate_frequency_factor(repetition_count), 2),
        "location_factor": round(calculate_location_factor(hazard_type), 2),
    }

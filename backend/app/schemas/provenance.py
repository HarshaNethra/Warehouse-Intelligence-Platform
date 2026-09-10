"""
WitWatch Perception Provenance Contract & Schema Definition.

Provides a formal application-level Pydantic contract for validating,
serializing, and parsing BehaviourObservation.details_json payloads across
live and offline inference pipelines.
"""

import json
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


class IdentityProvenance(BaseModel):
    observation_id: Optional[str] = None
    inference_run_id: Optional[str] = None
    video_id: Optional[str] = None
    track_id: Optional[int] = None

    class Config:
        from_attributes = True


class TemporalProvenance(BaseModel):
    frame_number: Optional[int] = None
    timestamp_seconds: Optional[float] = None
    video_fps: Optional[float] = None
    persistence_frames: Optional[int] = None

    class Config:
        from_attributes = True


class PerceptionProvenance(BaseModel):
    object_class: Optional[str] = None
    detector_confidence: Optional[float] = None  # None if unavailable at runtime
    trigger_bbox: Optional[List[float]] = None  # [x1, y1, x2, y2]
    pose_keypoints: Optional[Dict[str, Any]] = None  # Keypoints if available, None if lost

    class Config:
        from_attributes = True


class TrackingProvenance(BaseModel):
    track_age_frames: Optional[int] = None
    observation_gaps_in_window: Optional[int] = None

    class Config:
        from_attributes = True


class MotionProvenance(BaseModel):
    velocity_vector_px_s: Optional[List[float]] = None  # [vx, vy]
    acceleration_y_px_s2: Optional[float] = None
    acceleration_y_metric_estimate: Optional[float] = None  # Uncalibrated metric estimate (0.005 m/px scaling)
    peak_deceleration_px_s2: Optional[float] = None
    displacement_px: Optional[float] = None
    duration_seconds: Optional[float] = None
    stationary_tail: Optional[bool] = None

    class Config:
        from_attributes = True


class BehaviourRuleProvenance(BaseModel):
    rule_id: Optional[str] = None
    behaviour_type: Optional[str] = None
    measured_value: Optional[Any] = None
    threshold_applied: Optional[Any] = None
    unit: Optional[str] = None
    persistence_frames: Optional[int] = None
    rule_specific_evidence: Optional[Dict[str, Any]] = None  # Preserves rule evidence dict

    class Config:
        from_attributes = True


class RiskProvenance(BaseModel):
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    potential_consequence: Optional[str] = None
    recommended_action: Optional[str] = None

    class Config:
        from_attributes = True


class ModelRunProvenance(BaseModel):
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    inference_engine: Optional[str] = None
    device: Optional[str] = None
    processing_latency_ms: Optional[float] = None

    class Config:
        from_attributes = True


class BehaviourObservationDetails(BaseModel):
    identity: Optional[IdentityProvenance] = None
    temporal: Optional[TemporalProvenance] = None
    perception: Optional[PerceptionProvenance] = None
    tracking: Optional[TrackingProvenance] = None
    motion: Optional[MotionProvenance] = None
    behaviour: Optional[BehaviourRuleProvenance] = None
    risk: Optional[RiskProvenance] = None
    model_run: Optional[ModelRunProvenance] = None

    class Config:
        from_attributes = True


def parse_details_json(details_json_str: Optional[str]) -> BehaviourObservationDetails:
    """
    Safely parses a details_json database string into a BehaviourObservationDetails model.
    Handles:
      1. New validated contract JSON.
      2. Minimal live metadata JSON (legacy: {"rule_id": ..., "track_id": ...}).
      3. Offline evidence dict JSON (legacy: {"drop_height_px": ...}).
      4. Missing / None / invalid JSON strings safely.
    """
    if not details_json_str:
        return BehaviourObservationDetails()

    try:
        data = json.loads(details_json_str)
        if not isinstance(data, dict):
            return BehaviourObservationDetails()
    except Exception:
        return BehaviourObservationDetails()

    # Check if data already follows top-level contract schema
    contract_keys = {"identity", "temporal", "perception", "tracking", "motion", "behaviour", "risk", "model_run"}
    if any(k in data for k in contract_keys):
        try:
            return BehaviourObservationDetails.model_validate(data)
        except Exception:
            pass

    # Legacy or flat dictionary adapter
    identity = IdentityProvenance(
        track_id=int(data["track_id"]) if "track_id" in data and data["track_id"] is not None else None
    )
    temporal = TemporalProvenance(
        frame_number=int(data["frame_number"]) if "frame_number" in data and data["frame_number"] is not None else None,
        timestamp_seconds=float(data["timestamp"]) if "timestamp" in data and data["timestamp"] is not None else None,
        persistence_frames=int(data["duration_frames"]) if "duration_frames" in data and data["duration_frames"] is not None else None
    )
    motion = MotionProvenance(
        displacement_px=float(data["drop_height_px"]) if "drop_height_px" in data else (
            float(data["horizontal_displacement_px"]) if "horizontal_displacement_px" in data else (
                float(data["net_movement_distance_px"]) if "net_movement_distance_px" in data else None
            )
        ),
        peak_deceleration_px_s2=float(data["max_deceleration_px_s2"]) if "max_deceleration_px_s2" in data else (
            float(data["max_acceleration_px_s2"]) if "max_acceleration_px_s2" in data else None
        ),
        duration_seconds=float(data["duration_seconds"]) if "duration_seconds" in data else None,
        stationary_tail=bool(data["landing_near_floor"]) if "landing_near_floor" in data else None
    )
    behaviour = BehaviourRuleProvenance(
        rule_id=data.get("rule_id"),
        behaviour_type=data.get("behaviour_type") or data.get("behaviour"),
        rule_specific_evidence=data
    )

    return BehaviourObservationDetails(
        identity=identity,
        temporal=temporal,
        motion=motion,
        behaviour=behaviour
    )

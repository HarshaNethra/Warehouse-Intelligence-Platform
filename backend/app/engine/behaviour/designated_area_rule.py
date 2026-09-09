"""
Designated Area Rule: Flags handling operations conducted inside dangerous zones (dock ledge, wet floor).
"""

from typing import List, Tuple
from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.geometry import point_in_roi
from app.engine.behaviour.motion import TrackPoint, frame_displacement, sanitize_track


class DesignatedAreaRule(BaseRule):
    """
    Detects handling operations in designated, verified hazardous zones:
    Conditions:
      1. Target object must be a product carton (VALID_PRODUCT_CLASSES = {"carton"}).
      2. Requires an explicitly configured, verified hazard zone ROI (x1, y1, x2, y2).
         If no verified hazard zone is configured, returns [] cleanly.
      3. Macroscopic movement required: carton must undergo net displacement >= 60 px.
      4. Carton enters and persists within the verified zone for >= min_hazard_frames.
    """

    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "designated_area_rule"

    @property
    def behaviour_type(self) -> str:
        return "designated_area_violation"

    def _get_majority_class(self, points: List[TrackPoint]) -> str:
        classes = [p.class_name for p in points if p.class_name]
        if not classes:
            return "unknown"
        return max(set(classes), key=classes.count)

    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        points = sanitize_track(context.target_points)
        min_hazard_frames = max(6, int(round(0.4 * context.fps)))
        if len(points) < min_hazard_frames:
            return []

        # 1. Target object must be carton
        if self._get_majority_class(points) not in self.VALID_PRODUCT_CLASSES:
            return []

        # 2. Collect explicitly configured/verified hazard zones
        hazard_zones: List[Tuple[float, float, float, float]] = []
        if hasattr(self.config, "verified_hazard_zones") and self.config.verified_hazard_zones:
            hazard_zones.extend(self.config.verified_hazard_zones)
        if getattr(self.config, "wet_floor_roi", None) is not None:
            hazard_zones.append(self.config.wet_floor_roi)

        # If no verified hazard zone exists, return cleanly
        if not hazard_zones:
            return []

        # 3. Require macroscopic movement (net displacement >= 60 px)
        p_start = points[0]
        p_end = points[-1]
        _, _, net_dist = frame_displacement(p_start, p_end)
        if net_dist < 60.0:
            return []

        # 4. Check presence and persistence in verified hazard zone
        in_hazard_count = 0
        first_violation_point = None

        for p in points:
            if any(point_in_roi(p.x, p.y, roi) for roi in hazard_zones):
                in_hazard_count += 1
                if first_violation_point is None:
                    first_violation_point = p

        if in_hazard_count >= min_hazard_frames and first_violation_point is not None:
            p_start_violation = first_violation_point
            duration_s = (p_end.frame - p_start_violation.frame) / context.fps

            evidence = {
                "hazard_type": "verified_hazard_zone",
                "hazard_frames": in_hazard_count,
                "duration_seconds": round(duration_s, 2),
                "net_movement_distance_px": round(net_dist, 1),
                "location_x": round(p_start_violation.x, 1),
                "location_y": round(p_start_violation.y, 1),
            }

            desc = (
                f"Handling activity in verified designated hazard zone: "
                f"carton moved {net_dist:.0f}px and persisted for {duration_s:.2f}s ({in_hazard_count} frames)."
            )

            candidate = BehaviourCandidate(
                rule_name=self.rule_name,
                behaviour_type=self.behaviour_type,
                object_id=context.target_object_id,
                start_frame=p_start_violation.frame,
                end_frame=p_end.frame,
                confidence=0.88,
                primary_measurement=float(in_hazard_count),
                evidence=evidence,
                description=desc,
            )
            return [candidate]

        return []

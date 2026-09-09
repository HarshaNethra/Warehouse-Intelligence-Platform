"""
Product Drop Rule: Detects rapid downward vertical travel followed by sudden stop/landing.
"""

from typing import List
from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.geometry import is_near_floor
from app.engine.behaviour.motion import (
    TrackPoint,
    detect_sudden_impact,
    frame_displacement,
    is_stationary,
    sanitize_track,
    track_velocity,
)


class DropRule(BaseRule):
    """
    Detects sudden downward falling motions consistent with dropped cartons/products.
    Conditions:
      1. Valid product class: only {"carton"}
      2. Rapid downward vertical displacement (dy > drop_min_vertical_displacement_px).
      3. Downward velocity exceeds threshold (vy > drop_min_vertical_velocity_px_s).
      4. Predominantly vertical trajectory (|dx| / dy <= max_horizontal_ratio).
      5. Concludes near floor with sudden deceleration impact or post-event stationary rest.
    """
    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "drop_rule"

    @property
    def behaviour_type(self) -> str:
        return "product_dropped"

    def _get_majority_class(self, points: List[TrackPoint]) -> str:
        classes = [p.class_name for p in points if p.class_name]
        if not classes:
            return "unknown"
        return max(set(classes), key=classes.count)

    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        points = sanitize_track(context.target_points)
        if len(points) < self.config.min_track_frames:
            return []

        # 1. Product class filter: cartons only (rejects human worker tracks)
        majority_class = self._get_majority_class(points)
        if majority_class not in self.VALID_PRODUCT_CLASSES:
            return []

        candidates: List[BehaviourCandidate] = []
        n = len(points)

        # Examine sliding slices to detect rapid drops (descent usually happens within 0.2s - 1.0s)
        max_descent_frames = int(round(1.0 * context.fps))
        min_descent_frames = max(2, int(round(0.15 * context.fps)))

        i = 0
        while i < n - 1:
            p_start = points[i]
            found_drop = False

            for j in range(i + min_descent_frames, min(n, i + max_descent_frames + 1)):
                p_end = points[j]
                dx, dy, _ = frame_displacement(p_start, p_end)

                # Check downward vertical displacement
                if dy >= self.config.drop_min_vertical_displacement_px:
                    # Check vertical dominance
                    horiz_ratio = abs(dx) / max(1.0, dy)
                    if horiz_ratio <= self.config.drop_max_horizontal_ratio:
                        vx, vy, speed = track_velocity(p_start, p_end, context.fps)

                        if vy >= self.config.drop_min_vertical_velocity_px_s:
                            # Verify sudden deceleration or post-event stationary / near floor
                            tail_points = points[j:]
                            near_ground = is_near_floor(
                                p_end.y, p_end.height, context.frame_height, self.config.floor_y_ratio
                            )

                            has_impact, max_decel = detect_sudden_impact(
                                points[i : min(n, j + 5)],
                                decel_threshold_px_s2=self.config.sudden_impact_decel_threshold_px_s2,
                                fps=context.fps,
                            )

                            # Post-descent resting verification
                            stationary_tail = False
                            if len(tail_points) >= 3:
                                stationary_tail = is_stationary(
                                    tail_points[: int(round(self.config.drop_post_stationary_seconds * context.fps)) + 1],
                                    fps=context.fps,
                                )
                            else:
                                # Track disappeared or ended upon ground impact
                                stationary_tail = True

                            # Must conclude near floor AND have impact or stationary rest
                            if near_ground and (has_impact or stationary_tail):
                                duration_s = (p_end.frame - p_start.frame) / context.fps
                                confidence = min(
                                    0.95,
                                    0.50
                                    + (0.20 if has_impact else 0.0)
                                    + (0.15 if stationary_tail else 0.0)
                                    + (0.10 if near_ground else 0.0),
                                )

                                evidence = {
                                    "drop_height_px": round(dy, 1),
                                    "vertical_velocity_px_s": round(vy, 1),
                                    "duration_seconds": round(duration_s, 2),
                                    "landing_y": round(p_end.y, 1),
                                    "has_impact": has_impact,
                                    "max_deceleration_px_s2": round(max_decel, 1),
                                    "landing_near_floor": near_ground,
                                }

                                desc = (
                                    f"Product dropped from height of {dy:.0f}px at "
                                    f"{vy:.0f}px/s over {duration_s:.2f}s."
                                )

                                candidate = BehaviourCandidate(
                                    rule_name=self.rule_name,
                                    behaviour_type=self.behaviour_type,
                                    object_id=context.target_object_id,
                                    start_frame=p_start.frame,
                                    end_frame=p_end.frame,
                                    confidence=round(confidence, 2),
                                    primary_measurement=round(dy, 1),
                                    evidence=evidence,
                                    description=desc,
                                )
                                candidates.append(candidate)
                                i = j  # Jump past this drop
                                found_drop = True
                                break

            if not found_drop:
                i += 1

        return candidates

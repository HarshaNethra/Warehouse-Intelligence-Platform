"""
Product Throw Rule: Detects high-velocity ballistic motion or throwing of items.
"""

from typing import List
from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.geometry import center_distance
from app.engine.behaviour.motion import (
    TrackPoint,
    frame_displacement,
    instantaneous_velocities,
    sanitize_track,
)


class ThrowRule(BaseRule):
    """
    Detects throwing or tossing of cartons, packages, or warehouse products.
    Conditions:
      1. Target track must be a valid product class (primarily 'carton'). Person tracks are excluded.
      2. Significant net displacement (>= throw_min_displacement_px).
      3. Peak velocity exceeds throw_min_speed_px_s (> 300 px/s).
      4. Sustained flight velocity: net velocity and average velocity >= 150 px/s (rejects slow creeping drift).
      5. Throw evidence:
         - Initiated near a worker (worker release within 220px), OR
         - Distinct ballistic arc (apex elevation >= 10px above endpoints with sustained high speed >= 200 px/s).
    """

    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "throw_rule"

    @property
    def behaviour_type(self) -> str:
        return "product_thrown"

    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        points = sanitize_track(context.target_points)
        if len(points) < max(self.config.min_track_frames, self.config.throw_min_frames):
            return []

        # 1. Product class filtering: strictly exclude person tracks and non-product entities
        target_classes = [p.class_name for p in points if p.class_name]
        predominant_class = max(set(target_classes), key=target_classes.count) if target_classes else "unknown"
        if predominant_class not in self.VALID_PRODUCT_CLASSES:
            return []

        candidates: List[BehaviourCandidate] = []
        n = len(points)
        flight_window_max = int(round(1.5 * context.fps))  # Throws rarely exceed 1.5s in air
        flight_window_min = max(3, int(round(0.2 * context.fps)))

        i = 0
        while i < n - flight_window_min:
            p_start = points[i]
            found_throw = False

            for j in range(i + flight_window_min, min(n, i + flight_window_max + 1)):
                window = points[i : j + 1]
                dx, dy, net_dist = frame_displacement(p_start, points[j])

                if net_dist >= self.config.throw_min_displacement_px:
                    duration_s = (points[j].frame - p_start.frame) / context.fps
                    if duration_s <= 0:
                        continue

                    net_speed = net_dist / duration_s

                    vels = instantaneous_velocities(window, context.fps)
                    if not vels:
                        continue
                    speeds = [v[2] for v in vels]
                    max_speed = max(speeds)
                    avg_speed = sum(speeds) / len(speeds)

                    # Condition 1: Peak velocity threshold
                    if max_speed < self.config.throw_min_speed_px_s:
                        continue

                    # Condition 2: Sustained flight speed (rejects slow creeping drift / monitor jitter)
                    if net_speed < 150.0 or avg_speed < 150.0:
                        continue

                    # Condition 3: Parabolic arc with meaningful apex elevation (>= 10px rise above endpoints)
                    y_vals = [p.y for p in window]
                    apex_elevation = min(y_vals[0], y_vals[-1]) - min(y_vals)
                    has_arc = apex_elevation >= 10.0

                    # Condition 4: Worker proximity at launch
                    worker_at_start = False
                    start_frame = p_start.frame
                    for obj_id, other_pts in context.all_tracks.items():
                        if obj_id == context.target_object_id:
                            continue
                        for opt in other_pts:
                            if opt.frame == start_frame:
                                if center_distance(p_start.x, p_start.y, opt.x, opt.y) <= 220.0:
                                    worker_at_start = True
                                    break
                        if worker_at_start:
                            break

                    # Strong throw evidence requirement:
                    # Must be launched in proximity to a worker, OR demonstrate unambiguous ballistic flight
                    if not worker_at_start:
                        if not (has_arc and net_speed >= 200.0):
                            continue

                    confidence = min(
                        0.95,
                        0.65
                        + (0.15 if has_arc else 0.05)
                        + (0.15 if worker_at_start else 0.05),
                    )

                    evidence = {
                        "flight_distance_px": round(net_dist, 1),
                        "max_speed_px_s": round(max_speed, 1),
                        "average_speed_px_s": round(avg_speed, 1),
                        "duration_seconds": round(duration_s, 2),
                        "has_ballistic_arc": has_arc,
                        "launched_near_worker": worker_at_start,
                    }

                    desc = (
                        f"Product thrown / launched in air: traveled {net_dist:.0f}px at "
                        f"peak speed of {max_speed:.0f}px/s over {duration_s:.2f}s."
                    )

                    candidate = BehaviourCandidate(
                        rule_name=self.rule_name,
                        behaviour_type=self.behaviour_type,
                        object_id=context.target_object_id,
                        start_frame=p_start.frame,
                        end_frame=points[j].frame,
                        confidence=round(confidence, 2),
                        primary_measurement=round(net_dist, 1),
                        evidence=evidence,
                        description=desc,
                    )
                    candidates.append(candidate)
                    i = j
                    found_throw = True
                    break

            if not found_throw:
                i += 1

        return candidates

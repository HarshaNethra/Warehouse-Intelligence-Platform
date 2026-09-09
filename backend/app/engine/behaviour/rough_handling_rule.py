"""
Rough Handling Rule: Detects violent impacts, tumbling/rolling boxes, or erratic jarring motion.
"""

from typing import List
from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.motion import (
    TrackPoint,
    instantaneous_velocities,
    movement_direction_angle,
    net_displacement,
    sanitize_track,
    track_accelerations,
)


class RoughHandlingRule(BaseRule):
    """
    Detects abusive or rough handling manifested by:
      1. Rolling / tumbling / flipping boxes (aspect ratio inversion with macroscopic displacement).
      2. Multi-frame violent impact, hard kick, or shove with sustained momentum.
      3. Erratic zigzag trajectory with multiple high-speed direction rebounds.
    """
    VALID_PRODUCT_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "rough_handling_rule"

    @property
    def behaviour_type(self) -> str:
        return "rough_handling"

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
        window_size = min(self.config.sliding_window_size, n)

        i = 0
        while i <= n - window_size:
            window = points[i : i + window_size]
            vels = instantaneous_velocities(window, context.fps)
            accels = track_accelerations(window, context.fps)

            # Macroscopic motion metrics
            _, _, win_disp = net_displacement(window)
            speeds = [v[2] for v in vels]
            peak_speed = max(speeds, default=0.0)
            mean_speed = sum(speeds) / len(speeds) if speeds else 0.0

            # 1. Aspect Ratio / Rolling Tumbling Analysis
            aspect_ratios = [p.width / max(1.0, p.height) for p in window]
            min_ar = min(aspect_ratios)
            max_ar = max(aspect_ratios)
            ar_swing = (max_ar - min_ar) / max(0.1, min_ar)

            # 2. Acceleration Analysis (Multi-frame persistence)
            high_accel_thresh = self.config.rough_min_acceleration_px_s2  # 400 px/s²
            severe_accel_thresh = high_accel_thresh * 1.5                # 600 px/s²
            max_accel = max((a[2] for a in accels), default=0.0)
            high_accel_count = sum(1 for a in accels if a[2] >= high_accel_thresh)

            # 3. Abrupt Direction Reversals (filtered for non-trivial speed to avoid noise around 0)
            direction_reversals = 0
            for k in range(1, len(window) - 1):
                v1_mag = vels[k - 1][2] if k - 1 < len(vels) else 0.0
                v2_mag = vels[k][2] if k < len(vels) else 0.0
                if v1_mag < 40.0 or v2_mag < 40.0:
                    continue
                ang1 = movement_direction_angle(window[k - 1], window[k])
                ang2 = movement_direction_angle(window[k], window[k + 1])
                diff = abs(ang1 - ang2)
                if diff > 180:
                    diff = 360 - diff
                if diff >= 110.0:
                    direction_reversals += 1

            # --- Physical Trigger Conditions ---

            # Mode A: Box Rolling / Tumbling / Flipping
            # Geometry: Aspect ratio inverts (>= 0.30)
            # Kinematics: Macroscopic displacement (>= 25px) and dynamic motion speed (>= 40px/s)
            is_rolling = (
                ar_swing >= 0.30
                and win_disp >= 25.0
                and peak_speed >= 40.0
            )

            # Mode B: Multi-Frame Severe Impact / Violent Kick / Shove
            # Physical evidence requires ALL of:
            # 1. Extreme acceleration (>= 600 px/s²)
            # 2. Multi-frame acceleration: >= 2 frames with high acceleration (no single-frame spikes)
            # 3. Sustained high velocity (peak speed >= 180 px/s)
            # 4. Macroscopic floor displacement (>= 45 px)
            # 5. Physical impulse signature: either significant aspect ratio disruption (>= 0.20)
            #    or genuine rebound reversal (direction_reversals >= 1 with high path displacement)
            step_len_sum = sum(
                ((window[k].x - window[k - 1].x) ** 2 + (window[k].y - window[k - 1].y) ** 2) ** 0.5
                for k in range(1, len(window))
            )
            path_efficiency = win_disp / max(1.0, step_len_sum)

            is_severe_impact = (
                max_accel >= severe_accel_thresh
                and high_accel_count >= 2
                and peak_speed >= 180.0
                and win_disp >= 45.0
                and (ar_swing >= 0.20 or (direction_reversals >= 1 and path_efficiency >= 0.70))
            )

            # Mode C: Erratic Zigzag / Violent Jarring Motion
            # Kinematics: multiple sharp rebounds (>= 2), multiple high accel frames (>= 2),
            # with macroscopic displacement (>= 30px) and peak speed >= 80px/s
            is_erratic = (
                direction_reversals >= 2
                and high_accel_count >= 2
                and win_disp >= 30.0
                and peak_speed >= 80.0
            )

            if is_rolling or is_erratic or is_severe_impact:
                p_start = window[0]
                p_end = window[-1]
                duration_s = (p_end.frame - p_start.frame) / context.fps

                confidence = min(
                    0.95,
                    0.60
                    + (0.20 if is_rolling else 0.0)
                    + (0.15 if is_severe_impact else 0.0)
                    + (0.10 if is_erratic else 0.0),
                )

                nature = []
                if is_rolling:
                    nature.append("box rolling/tumbling")
                if is_severe_impact:
                    nature.append(f"severe acceleration spike ({max_accel:.0f}px/s²)")
                if is_erratic:
                    nature.append("erratic zigzag trajectory")

                desc = f"Rough handling detected: {', '.join(nature)} over {duration_s:.2f}s."

                evidence = {
                    "max_acceleration_px_s2": round(max_accel, 1),
                    "aspect_ratio_swing": round(ar_swing, 2),
                    "direction_reversals": direction_reversals,
                    "displacement_px": round(win_disp, 1),
                    "peak_speed_px_s": round(peak_speed, 1),
                    "duration_seconds": round(duration_s, 2),
                    "nature": nature,
                }

                candidate = BehaviourCandidate(
                    rule_name=self.rule_name,
                    behaviour_type=self.behaviour_type,
                    object_id=context.target_object_id,
                    start_frame=p_start.frame,
                    end_frame=p_end.frame,
                    confidence=round(confidence, 2),
                    primary_measurement=round(max_accel, 1),
                    evidence=evidence,
                    description=desc,
                )
                candidates.append(candidate)
                i += window_size  # Step past this window
            else:
                i += 3

        return candidates

"""
Sequence Rule: Detects unsafe handling sequences, such as workers stepping on lower cartons to reach higher stacks.
"""

from typing import List
from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.geometry import (
    horizontal_overlap_ratio,
    object_above_object,
    to_corners,
)
from app.engine.behaviour.motion import TrackPoint, sanitize_track


class SequenceRule(BaseRule):
    """
    Detects hazardous workflow sequence violations.
    In warehouse handling, stepping on cartons to access higher goods is a severe violation
    that crushes packages and creates worker fall risks.
    Conditions:
      1. Target object must be a worker (person track).
      2. Supporting/base object must be a product carton.
      3. Supporting carton must be stationary (< 25 px/s).
      4. Worker's feet physically align with carton top boundary (-15px <= gap <= 25px, horiz overlap >= 40%).
      5. Scale consistency: worker height must be physically plausible relative to carton (>= 0.6 * carton height).
      6. Condition persists for at least 15 consecutive frames (0.50s).
    """

    VALID_TARGET_CLASSES = {"person"}
    VALID_BASE_CLASSES = {"carton"}

    @property
    def rule_name(self) -> str:
        return "sequence_rule"

    @property
    def behaviour_type(self) -> str:
        return "stepping_on_cartons"

    def _get_majority_class(self, points: List[TrackPoint]) -> str:
        classes = [p.class_name for p in points if p.class_name]
        if not classes:
            return "unknown"
        return max(set(classes), key=classes.count)

    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        points = sanitize_track(context.target_points)
        min_persist_frames = max(15, int(round(0.50 * context.fps)))
        if len(points) < min_persist_frames:
            return []

        # 1. Target object must be person
        if self._get_majority_class(points) not in self.VALID_TARGET_CLASSES:
            return []

        candidates: List[BehaviourCandidate] = []
        target_by_frame = {p.frame: p for p in points}

        for other_id, other_track in context.all_tracks.items():
            if other_id == context.target_object_id:
                continue

            other_pts = sanitize_track(other_track)
            if len(other_pts) < min_persist_frames:
                continue

            # 2. Base object must be carton
            if self._get_majority_class(other_pts) not in self.VALID_BASE_CLASSES:
                continue

            other_by_frame = {p.frame: p for p in other_pts}
            common_frames = sorted(set(target_by_frame.keys()) & set(other_by_frame.keys()))
            if len(common_frames) < min_persist_frames:
                continue

            consecutive_run = []
            prev_frame = None

            for f in common_frames:
                if prev_frame is not None and f != prev_frame + 1:
                    if len(consecutive_run) >= min_persist_frames:
                        cand = self._create_candidate(consecutive_run, other_pts, context, other_id)
                        if cand:
                            candidates.append(cand)
                    consecutive_run = []

                prev_frame = f
                p_target = target_by_frame[f]
                p_other = other_by_frame[f]

                target_box = (p_target.x, p_target.y, p_target.width, p_target.height)
                other_box = (p_other.x, p_other.y, p_other.width, p_other.height)

                # 3. Scale-consistency check:
                # Distant background worker projected in 2D over foreground carton has tiny height
                if p_target.height < 0.6 * p_other.height:
                    if len(consecutive_run) >= min_persist_frames:
                        cand = self._create_candidate(consecutive_run, other_pts, context, other_id)
                        if cand:
                            candidates.append(cand)
                    consecutive_run = []
                    continue

                # 4. Physically plausible foot-to-carton contact
                _, _, _, target_bottom = to_corners(*target_box)
                _, other_top, _, _ = to_corners(*other_box)
                vertical_gap = other_top - target_bottom

                if -15.0 <= vertical_gap <= 25.0:
                    h_overlap = horizontal_overlap_ratio(target_box, other_box)
                    if h_overlap >= 0.40:
                        consecutive_run.append((f, p_target, p_other, h_overlap))
                        continue

                if len(consecutive_run) >= min_persist_frames:
                    cand = self._create_candidate(consecutive_run, other_pts, context, other_id)
                    if cand:
                        candidates.append(cand)
                consecutive_run = []

            if len(consecutive_run) >= min_persist_frames:
                cand = self._create_candidate(consecutive_run, other_pts, context, other_id)
                if cand:
                    candidates.append(cand)

        return candidates

    def _create_candidate(
        self,
        run: List,
        other_pts: List[TrackPoint],
        context: TrajectoryContext,
        other_id: int,
    ) -> BehaviourCandidate:
        start_f = run[0][0]
        end_f = run[-1][0]
        duration_s = (end_f - start_f + 1) / context.fps

        # Check base stationary velocity across the run (< 25 px/s)
        base_run_pts = [p for p in other_pts if start_f <= p.frame <= end_f]
        if base_run_pts:
            dur = max(0.01, (base_run_pts[-1].frame - base_run_pts[0].frame) / context.fps)
            dx = base_run_pts[-1].x - base_run_pts[0].x
            dy = base_run_pts[-1].y - base_run_pts[0].y
            disp = (dx**2 + dy**2)**0.5
            speed = disp / dur
            if speed > 25.0:
                return None

        p_start = run[0][1]
        avg_h_overlap = sum(r[3] for r in run) / len(run)

        evidence = {
            "duration_seconds": round(duration_s, 2),
            "elevation_y": round(p_start.y, 1),
            "sustained_frames": len(run),
            "supporting_carton_id": other_id,
            "horizontal_overlap": round(avg_h_overlap, 2),
            "violation": "Worker standing/stepping on cartons to reach upper tier",
        }

        desc = (
            f"Unsafe sequence / stepping violation: worker elevated on carton {other_id} "
            f"at y={p_start.y:.0f}px for {duration_s:.2f}s."
        )

        return BehaviourCandidate(
            rule_name=self.rule_name,
            behaviour_type=self.behaviour_type,
            object_id=context.target_object_id,
            start_frame=start_f,
            end_frame=end_f,
            confidence=0.88,
            primary_measurement=round(p_start.y, 1),
            evidence=evidence,
            description=desc,
        )

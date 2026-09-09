"""
Behaviour Rule Engine Orchestrator.

Loads rules, ingests trajectory data, executes rules over multi-object streams,
applies debouncing/merging, and produces deduplicated behaviour candidates.
"""

from pathlib import Path
from typing import Dict, List, Optional, Union
import pandas as pd

from app.engine.behaviour.base_rule import BaseRule, BehaviourCandidate, TrajectoryContext
from app.engine.behaviour.config import BehaviourConfig, DEFAULT_CONFIG
from app.engine.behaviour.designated_area_rule import DesignatedAreaRule
from app.engine.behaviour.drag_rule import DragRule
from app.engine.behaviour.drop_rule import DropRule
from app.engine.behaviour.equipment_rule import EquipmentRule
from app.engine.behaviour.motion import TrackPoint
from app.engine.behaviour.rough_handling_rule import RoughHandlingRule
from app.engine.behaviour.sequence_rule import SequenceRule
from app.engine.behaviour.stacking_rule import StackingRule
from app.engine.behaviour.temporal import (
    DebounceManager,
    merge_overlapping_candidates,
    resolve_incident_overlaps,
)
from app.engine.behaviour.throw_rule import ThrowRule
from app.engine.behaviour.unstable_stack_rule import UnstableStackRule


class RuleEngine:
    """
    Coordinates spatiotemporal analysis across all registered rules.
    """

    def __init__(self, config: Optional[BehaviourConfig] = None, rules: Optional[List[BaseRule]] = None):
        self.config = config or DEFAULT_CONFIG
        self.rules = rules if rules is not None else self._default_rules()
        self.debounce = DebounceManager(default_cooldown_frames=self.config.cooldown_frames)

    def _default_rules(self) -> List[BaseRule]:
        """Instantiates the standard 9 behaviour detection rules."""
        return [
            DropRule(self.config),
            DragRule(self.config),
            ThrowRule(self.config),
            RoughHandlingRule(self.config),
            StackingRule(self.config),
            UnstableStackRule(self.config),
            DesignatedAreaRule(self.config),
            EquipmentRule(self.config),
            SequenceRule(self.config),
        ]

    def parse_trajectory_csv(self, csv_source: Union[str, Path, pd.DataFrame]) -> Dict[int, List[TrackPoint]]:
        """
        Parses trajectory CSV (or DataFrame) into a dictionary mapping:
        object_id -> List[TrackPoint] sorted by frame.
        """
        if isinstance(csv_source, (str, Path)):
            df = pd.read_csv(csv_source)
        else:
            df = csv_source

        tracks: Dict[int, List[TrackPoint]] = {}

        for _, row in df.iterrows():
            obj_id = int(row["object_id"])
            pt = TrackPoint(
                frame=int(row["frame"]),
                x=float(row["x"]),
                y=float(row["y"]),
                width=float(row["width"]),
                height=float(row["height"]),
                class_name=str(row.get("class", "person")),
            )
            tracks.setdefault(obj_id, []).append(pt)

        # Sort each track strictly by frame
        for obj_id in tracks:
            tracks[obj_id].sort(key=lambda p: p.frame)

        return tracks

    def process_tracks(self, tracks: Dict[int, List[TrackPoint]],
                       fps: float = 30.0,
                       video_name: str = "video") -> List[BehaviourCandidate]:
        """
        Runs all active rules over parsed multi-object tracks.
        """
        raw_candidates: List[BehaviourCandidate] = []

        for obj_id, target_points in tracks.items():
            if len(target_points) < self.config.min_track_frames:
                continue

            ctx = TrajectoryContext(
                target_object_id=obj_id,
                target_points=target_points,
                all_tracks=tracks,
                fps=fps,
                frame_width=self.config.frame_width,
                frame_height=self.config.frame_height,
                video_name=video_name,
                config=self.config,
            )

            for rule in self.rules:
                try:
                    found = rule.evaluate(ctx)
                    for candidate in found:
                        # Check debounce cooldown
                        if self.debounce.can_trigger(candidate.rule_name, candidate.object_id, candidate.start_frame):
                            raw_candidates.append(candidate)
                            self.debounce.register_trigger(candidate.rule_name, candidate.object_id, candidate.end_frame)
                except Exception as exc:
                    # Keep processing other rules/tracks while logging or raising if severe
                    print(f"Warning: Rule {rule.rule_name} encountered error on obj {obj_id}: {exc}")

        # Post-process: merge temporally overlapping candidates of same type on same object
        clean_candidates = merge_overlapping_candidates(raw_candidates, overlap_frame_threshold=self.config.cooldown_frames)
        # Cross-behaviour incident resolution and deduplication on the same object
        clean_candidates = resolve_incident_overlaps(clean_candidates, fps=fps)
        return clean_candidates

    def process_csv(self, csv_path: Union[str, Path], fps: float = 30.0) -> List[BehaviourCandidate]:
        """Convenience method to process a single trajectory CSV file."""
        path = Path(csv_path)
        tracks = self.parse_trajectory_csv(path)
        video_name = path.stem.replace("_trajectories", "")
        return self.process_tracks(tracks, fps=fps, video_name=video_name)

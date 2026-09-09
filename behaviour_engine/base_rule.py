"""
Base Rule Interface and Behaviour Candidate Data Structures.

Every rule inherits from BaseRule and implements evaluate(context) -> List[BehaviourCandidate].
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple
from behaviour_engine.config import BehaviourConfig, DEFAULT_CONFIG
from behaviour_engine.motion import TrackPoint


@dataclass
class BehaviourCandidate:
    """
    Standardized intermediate candidate emitted by a behaviour rule.
    """
    rule_name: str
    behaviour_type: str
    object_id: int
    start_frame: int
    end_frame: int
    confidence: float
    primary_measurement: float
    evidence: Dict[str, Any] = field(default_factory=dict)
    description: str = ""

    @property
    def duration_frames(self) -> int:
        return max(1, self.end_frame - self.start_frame)


@dataclass
class TrajectoryContext:
    """
    Spatiotemporal context provided to a rule during evaluation.
    Contains the target track's history, all other synchronized tracks in the scene,
    environmental metadata, and active configuration.
    """
    target_object_id: int
    target_points: List[TrackPoint]
    all_tracks: Dict[int, List[TrackPoint]]
    fps: float = 30.0
    frame_width: int = 1280
    frame_height: int = 720
    video_name: str = "warehouse_video"
    config: BehaviourConfig = field(default_factory=lambda: DEFAULT_CONFIG)

    def get_tracks_at_frame(self, frame: int) -> List[TrackPoint]:
        """Returns all object points visible at a specific frame."""
        points = []
        for _, pts in self.all_tracks.items():
            for p in pts:
                if p.frame == frame:
                    points.append(p)
        return points


class BaseRule(ABC):
    """
    Abstract Base Class for all spatiotemporal behaviour detection rules.
    """

    def __init__(self, config: Optional[BehaviourConfig] = None):
        self.config = config or DEFAULT_CONFIG

    @property
    @abstractmethod
    def rule_name(self) -> str:
        """Unique human-readable identifier for the rule."""
        pass

    @property
    @abstractmethod
    def behaviour_type(self) -> str:
        """Canonical behaviour type key (e.g. 'product_dropped', 'product_dragged')."""
        pass

    @abstractmethod
    def evaluate(self, context: TrajectoryContext) -> List[BehaviourCandidate]:
        """
        Evaluates the rule against the provided trajectory context.
        Returns a list of detected candidates (empty list if no conditions triggered).
        """
        pass

"""
Unit tests for all 9 behaviour rules using synthetic trajectories.
Each rule is tested with positive trigger scenarios, negative controls, and edge cases.
"""

import unittest
from behaviour_engine.base_rule import TrajectoryContext
from behaviour_engine.config import DEFAULT_CONFIG, BehaviourConfig
from behaviour_engine.designated_area_rule import DesignatedAreaRule
from behaviour_engine.drag_rule import DragRule
from behaviour_engine.drop_rule import DropRule
from behaviour_engine.equipment_rule import EquipmentRule
from behaviour_engine.motion import TrackPoint
from behaviour_engine.rough_handling_rule import RoughHandlingRule
from behaviour_engine.sequence_rule import SequenceRule
from behaviour_engine.stacking_rule import StackingRule
from behaviour_engine.throw_rule import ThrowRule
from behaviour_engine.unstable_stack_rule import UnstableStackRule


class TestBehaviourRules(unittest.TestCase):

    def setUp(self):
        self.config = DEFAULT_CONFIG

    # -------------------------------------------------------------------------
    # 1. Drop Rule
    # -------------------------------------------------------------------------
    def test_drop_rule_positive(self):
        # Carton starts at y=200, drops rapidly to y=520 (dy=320px) over 10 frames (0.33s), then rests on floor
        pts = []
        for f in range(0, 10):
            # Descent: y increases rapidly
            y = 200.0 + (f * 32.0)
            pts.append(TrackPoint(frame=f, x=600.0, y=y, width=80.0, height=80.0, class_name="carton"))
        for f in range(10, 25):
            # Stationary landing at floor level (y=520)
            pts.append(TrackPoint(frame=f, x=600.0, y=520.0, width=80.0, height=80.0, class_name="carton"))

        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = DropRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].behaviour_type, "product_dropped")
        self.assertGreater(candidates[0].primary_measurement, 65.0)

    def test_drop_rule_negative_slow_movement(self):
        # Normal slow lowering (dy=50px over 40 frames -> vy ~ 37 px/s, below 200 px/s threshold)
        pts = [
            TrackPoint(frame=f, x=600.0, y=200.0 + (f * 1.25), width=80.0, height=80.0, class_name="carton")
            for f in range(40)
        ]
        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = DropRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_drop_rule_negative_person_walking_toward_camera(self):
        """A person walking toward camera (dy > 65px due to perspective) must NOT trigger product_dropped."""
        pts = [
            TrackPoint(frame=f, x=648.0 - (f * 2.0), y=335.0 + (f * 7.0), width=130.0, height=350.0, class_name="person")
            for f in range(15)
        ]
        ctx = TrajectoryContext(target_object_id=884, target_points=pts, all_tracks={884: pts}, fps=30.0)
        rule = DropRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person walking toward camera must be rejected by DropRule")

    def test_drop_rule_negative_person_bending(self):
        """A person bending downward at the waist must NOT trigger product_dropped."""
        pts = [
            TrackPoint(frame=f, x=500.0, y=380.0 + (f * 7.0), width=170.0, height=300.0, class_name="person")
            for f in range(12)
        ]
        ctx = TrajectoryContext(target_object_id=885, target_points=pts, all_tracks={885: pts}, fps=30.0)
        rule = DropRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person bending must be rejected by DropRule")

    def test_drop_rule_negative_mid_air_vertical_motion(self):
        """Downward carton motion ending in mid-air (above floor zone) must NOT trigger product_dropped."""
        pts = [
            TrackPoint(frame=f, x=500.0, y=100.0 + (f * 10.0), width=60.0, height=60.0, class_name="carton")
            for f in range(10)
        ]
        # At f=9: y=190, h=60 -> bottom_y = 220 << 432 (floor zone)
        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = DropRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Mid-air vertical travel above floor must not trigger product_dropped")

    # -------------------------------------------------------------------------
    # 2. Drag Rule
    # -------------------------------------------------------------------------
    def test_drag_rule_positive(self):
        # Heavy item dragged horizontally on floor (y=550px) over 40 frames (1.33s), traveling dx=180px
        pts = [
            TrackPoint(frame=f, x=200.0 + (f * 4.5), y=550.0, width=100.0, height=100.0, class_name="carton")
            for f in range(40)
        ]
        # Nearby worker walking along at distance 80px
        worker_pts = [
            TrackPoint(frame=f, x=150.0 + (f * 4.5), y=500.0, width=70.0, height=150.0, class_name="person")
            for f in range(40)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=pts, all_tracks={1: pts, 2: worker_pts}, fps=30.0
        )
        rule = DragRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].behaviour_type, "product_dragged")

    def test_drag_rule_negative_normal_carry(self):
        # Item carried high above floor plane (y=250px)
        pts = [
            TrackPoint(frame=f, x=200.0 + (f * 4.5), y=250.0, width=60.0, height=60.0, class_name="carton")
            for f in range(40)
        ]
        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = DragRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_drag_rule_negative_person_walking(self):
        # Human worker walking across floor plane (y=550px) over 40 frames, dx=180px
        pts = [
            TrackPoint(frame=f, x=200.0 + (f * 4.5), y=550.0, width=80.0, height=160.0, class_name="person")
            for f in range(40)
        ]
        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = DragRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person walking along floor must not trigger product_dragged")

    def test_drag_rule_positive_large_carton_bbox_overlap(self):
        # 450px wide cupboard carton dragged on floor, worker center 270px away (center dist > 250px)
        # but bounding boxes physically overlap (overlap = 5px)
        pts = [
            TrackPoint(frame=f, x=300.0 + (f * 3.0), y=500.0, width=450.0, height=450.0, class_name="carton")
            for f in range(40)
        ]
        worker_pts = [
            TrackPoint(frame=f, x=570.0 + (f * 3.0), y=500.0, width=100.0, height=160.0, class_name="person")
            for f in range(40)
        ]
        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts, 2: worker_pts}, fps=30.0)
        rule = DragRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertGreater(len(candidates), 0, "Large carton with bounding box overlap must be detected")
        self.assertEqual(candidates[0].behaviour_type, "product_dragged")
        self.assertTrue(candidates[0].evidence["worker_nearby"])

    # -------------------------------------------------------------------------
    # 3. Throw Rule
    # -------------------------------------------------------------------------
    def test_throw_rule_positive(self):
        # Ballistic toss: traveling from x=200 to x=450 (dx=250px) in 15 frames (0.5s) -> vx ~ 500 px/s
        pts = []
        for f in range(15):
            x = 200.0 + (f * 16.6)
            # Parabolic arc in y: rises then descends
            y = 350.0 - (4.0 * f * (14 - f) / 10.0)
            pts.append(TrackPoint(frame=f, x=x, y=y, width=70.0, height=70.0, class_name="carton"))

        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = ThrowRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].behaviour_type, "product_thrown")

    def test_throw_rule_negative_slow_move(self):
        # Gentle move at 50 px/s
        pts = [
            TrackPoint(frame=f, x=200.0 + (f * 1.6), y=350.0, width=70.0, height=70.0, class_name="carton")
            for f in range(30)
        ]
        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = ThrowRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_throw_rule_negative_person_track(self):
        """A person moving rapidly or jumping must NOT trigger product_thrown."""
        pts = []
        for f in range(15):
            x = 200.0 + (f * 16.6)
            y = 350.0 - (4.0 * f * (14 - f) / 10.0)
            pts.append(TrackPoint(frame=f, x=x, y=y, width=70.0, height=160.0, class_name="person"))

        ctx = TrajectoryContext(target_object_id=884, target_points=pts, all_tracks={884: pts}, fps=30.0)
        rule = ThrowRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person tracks must be rejected by ThrowRule.")

    def test_throw_rule_negative_stationary_carton_jitter(self):
        """A stationary floor carton with detector jitter/drift must NOT trigger product_thrown."""
        # Simulates Object 996: slow 90px drift over 40 frames (~67 px/s) with a single 1-frame jitter spike
        pts = []
        for f in range(40):
            jitter = 11.0 if f == 15 else 0.0
            pts.append(TrackPoint(
                frame=f,
                x=960.0 + (f * 2.0) + jitter,
                y=475.0 + (f * 0.5),
                width=240.0,
                height=200.0,
                class_name="carton"
            ))

        ctx = TrajectoryContext(target_object_id=996, target_points=pts, all_tracks={996: pts}, fps=30.0)
        rule = ThrowRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Stationary cartons with box jitter must not trigger product_thrown.")

    # -------------------------------------------------------------------------
    # 4. Rough Handling Rule
    # -------------------------------------------------------------------------
    def test_rough_handling_positive_rolling(self):
        # Box flipping/rolling over: width and height alternate 60x140 -> 140x60 -> 60x140
        pts = []
        for f in range(15):
            w = 60.0 if (f // 3) % 2 == 0 else 140.0
            h = 140.0 if (f // 3) % 2 == 0 else 60.0
            x = 400.0 + (f * 10.0)
            pts.append(TrackPoint(frame=f, x=x, y=500.0, width=w, height=h, class_name="carton"))

        ctx = TrajectoryContext(target_object_id=1, target_points=pts, all_tracks={1: pts}, fps=30.0)
        rule = RoughHandlingRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].behaviour_type, "rough_handling")
        self.assertIn("box rolling/tumbling", candidates[0].evidence.get("nature", []))

    def test_rough_handling_negative_person_track(self):
        """A person moving rapidly, jumping or bending over must NOT trigger rough_handling."""
        pts = []
        for f in range(20):
            w = 50.0 + (f * 2.0)
            h = 160.0 - (f * 3.0)
            x = 200.0 + (f * 8.0)
            pts.append(TrackPoint(frame=f, x=x, y=400.0, width=w, height=h, class_name="person"))

        ctx = TrajectoryContext(target_object_id=884, target_points=pts, all_tracks={884: pts}, fps=30.0)
        rule = RoughHandlingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person tracks must be rejected by RoughHandlingRule")

    def test_rough_handling_negative_stationary_carton_jitter(self):
        """A stationary carton with detector centroid jitter must NOT trigger rough_handling."""
        pts = []
        for f in range(30):
            jitter_x = 2.0 if f % 2 == 1 else -2.0
            jitter_y = 1.5 if (f // 2) % 2 == 1 else -1.5
            pts.append(TrackPoint(frame=f, x=500.0 + jitter_x, y=550.0 + jitter_y, width=120.0, height=100.0, class_name="carton"))

        ctx = TrajectoryContext(target_object_id=996, target_points=pts, all_tracks={996: pts}, fps=30.0)
        rule = RoughHandlingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Stationary carton with jitter must not trigger rough_handling")

    def test_rough_handling_negative_stationary_background_carton(self):
        """A stationary background pallet carton with slow camera pan drift must NOT trigger rough_handling."""
        pts = []
        for f in range(40):
            pts.append(TrackPoint(frame=f, x=800.0 + (f * 1.5), y=75.0, width=150.0, height=130.0, class_name="carton"))

        ctx = TrajectoryContext(target_object_id=941, target_points=pts, all_tracks={941: pts}, fps=30.0)
        rule = RoughHandlingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Stationary background carton with camera drift must not trigger rough_handling")

    def test_rough_handling_negative_isolated_acceleration_spike(self):
        """A single-frame acceleration spike on a stationary carton must NOT trigger rough_handling."""
        pts = []
        for f in range(25):
            glitch = 5.0 if f == 12 else 0.0
            pts.append(TrackPoint(frame=f, x=600.0 + glitch, y=500.0, width=100.0, height=100.0, class_name="carton"))

        ctx = TrajectoryContext(target_object_id=1055, target_points=pts, all_tracks={1055: pts}, fps=30.0)
        rule = RoughHandlingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Isolated 1-frame acceleration spike must not trigger rough_handling")

    def test_rough_handling_positive_short_sequence(self):
        """A 5-frame short genuine rolling/flipping sequence must still be detectable."""
        pts = [
            TrackPoint(frame=190, x=400.0, y=500.0, width=60.0, height=140.0, class_name="carton"),
            TrackPoint(frame=191, x=420.0, y=490.0, width=100.0, height=120.0, class_name="carton"),
            TrackPoint(frame=192, x=445.0, y=480.0, width=120.0, height=100.0, class_name="carton"),
            TrackPoint(frame=193, x=475.0, y=510.0, width=140.0, height=70.0, class_name="carton"),
            TrackPoint(frame=194, x=500.0, y=520.0, width=140.0, height=60.0, class_name="carton"),
        ]
        ctx = TrajectoryContext(target_object_id=1047, target_points=pts, all_tracks={1047: pts}, fps=30.0)
        rule = RoughHandlingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertGreater(len(candidates), 0, "Short 5-frame rolling sequence must be detectable")
        self.assertEqual(candidates[0].behaviour_type, "rough_handling")
        self.assertIn("box rolling/tumbling", candidates[0].evidence.get("nature", []))

    # -------------------------------------------------------------------------
    # 5. Stacking Rule (Improper Stacking)
    # -------------------------------------------------------------------------
    def test_stacking_rule_positive(self):
        # Genuine inverted-pyramid carton stack >= 1.35 area ratio persisting >=15 frames
        # Lower fragile box: center=(500, 550), w=80, h=80 (area=6400)
        base_box = [TrackPoint(frame=f, x=500.0, y=550.0, width=80.0, height=80.0, class_name="carton") for f in range(25)]
        # Upper heavy box: center=(500, 430), w=130, h=130 (area=16900 -> area ratio = 2.64)
        top_box = [TrackPoint(frame=f, x=500.0, y=430.0, width=130.0, height=130.0, class_name="carton") for f in range(25)]

        ctx = TrajectoryContext(
            target_object_id=2, target_points=top_box, all_tracks={1: base_box, 2: top_box}, fps=30.0
        )
        rule = StackingRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0, "Genuine inverted-pyramid carton stack persisting >=15 frames must be detected")
        self.assertEqual(candidates[0].behaviour_type, "improper_stacking")
        self.assertGreaterEqual(candidates[0].evidence["area_ratio"], 1.35)

    def test_stacking_rule_negative_person_over_carton(self):
        # Walking person appearing above carton in 2D perspective / split screen
        base_box = [TrackPoint(frame=f, x=500.0, y=550.0, width=80.0, height=80.0, class_name="carton") for f in range(25)]
        top_person = [TrackPoint(frame=f, x=500.0, y=430.0, width=130.0, height=180.0, class_name="person") for f in range(25)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=top_person, all_tracks={1: base_box, 2: top_person}, fps=30.0
        )
        rule = StackingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person appearing above carton must not trigger improper_stacking")

    def test_stacking_rule_negative_carton_over_person(self):
        # Carton in background appearing above foreground person
        base_person = [TrackPoint(frame=f, x=500.0, y=550.0, width=80.0, height=180.0, class_name="person") for f in range(25)]
        top_box = [TrackPoint(frame=f, x=500.0, y=430.0, width=130.0, height=130.0, class_name="carton") for f in range(25)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=top_box, all_tracks={1: base_person, 2: top_box}, fps=30.0
        )
        rule = StackingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Carton appearing above person must not trigger improper_stacking")

    def test_stacking_rule_negative_equal_sized_stack(self):
        # Normal safe pallet stack with equal-sized cartons (area ratio = 1.0 < 1.35)
        base_box = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        top_box = [TrackPoint(frame=f, x=500.0, y=450.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=top_box, all_tracks={1: base_box, 2: top_box}, fps=30.0
        )
        rule = StackingRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Normal pallet stack with equal-sized cartons must not trigger improper_stacking")


    # -------------------------------------------------------------------------
    # 6. Unstable Stacking Rule
    # -------------------------------------------------------------------------
    def test_unstable_stack_positive(self):
        # Genuine carton-on-carton with >=30% overhang persisting >=15 frames
        # Lower box: center=(500, 550), w=100, h=100 -> [450..550]
        base_box = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        # Upper box severely shifted to right: center=(560, 450), w=100, h=100 -> [510..610]
        # Overhang to right = 610 - 550 = 60px -> ratio = 60/100 = 60% > 30%
        top_box = [TrackPoint(frame=f, x=560.0, y=450.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]

        ctx = TrajectoryContext(
            target_object_id=2, target_points=top_box, all_tracks={1: base_box, 2: top_box}, fps=30.0
        )
        rule = UnstableStackRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0, "Genuine unstable carton stack persisting >=15 frames must be detected")
        self.assertEqual(candidates[0].behaviour_type, "unstable_stack")
        self.assertGreaterEqual(candidates[0].evidence["overhang_ratio"], 0.30)

    def test_unstable_stack_negative_person_on_person(self):
        # Two walking people in perspective alignment (one behind another)
        base = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=180.0, class_name="person") for f in range(25)]
        top = [TrackPoint(frame=f, x=560.0, y=360.0, width=100.0, height=180.0, class_name="person") for f in range(25)]
        ctx = TrajectoryContext(target_object_id=2, target_points=top, all_tracks={1: base, 2: top}, fps=30.0)
        rule = UnstableStackRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person-on-person alignment must not trigger unstable_stack")

    def test_unstable_stack_negative_carton_over_person(self):
        # Background carton aligning with foreground person in 2D projection
        base = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=180.0, class_name="person") for f in range(25)]
        top = [TrackPoint(frame=f, x=560.0, y=360.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        ctx = TrajectoryContext(target_object_id=2, target_points=top, all_tracks={1: base, 2: top}, fps=30.0)
        rule = UnstableStackRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Carton-over-person perspective alignment must not trigger unstable_stack")

    def test_unstable_stack_negative_person_over_carton(self):
        # Background person walking past foreground carton on floor
        base = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        top = [TrackPoint(frame=f, x=560.0, y=440.0, width=100.0, height=180.0, class_name="person") for f in range(25)]
        ctx = TrajectoryContext(target_object_id=2, target_points=top, all_tracks={1: base, 2: top}, fps=30.0)
        rule = UnstableStackRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Person-over-carton perspective alignment must not trigger unstable_stack")

    def test_unstable_stack_negative_stable_carton_stack(self):
        # Stable carton stack with slight 5% overhang (< 30%)
        base = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        top = [TrackPoint(frame=f, x=505.0, y=450.0, width=100.0, height=100.0, class_name="carton") for f in range(25)]
        ctx = TrajectoryContext(target_object_id=2, target_points=top, all_tracks={1: base, 2: top}, fps=30.0)
        rule = UnstableStackRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0, "Stable carton stack with <30% overhang must not trigger unstable_stack")


    # -------------------------------------------------------------------------
    # 7. Designated Area Rule
    # -------------------------------------------------------------------------
    def test_designated_area_positive(self):
        # Carton moving > 60px inside explicitly configured verified hazard zone
        cfg = BehaviourConfig(verified_hazard_zones=((100.0, 100.0, 600.0, 600.0),))
        pts = [
            TrackPoint(frame=f, x=200.0 + (f * 5.0), y=300.0, width=80.0, height=80.0, class_name="carton")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=pts, all_tracks={1: pts}, video_name="general_video"
        )
        rule = DesignatedAreaRule(cfg)
        candidates = rule.evaluate(ctx)

        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].behaviour_type, "designated_area_violation")

    def test_designated_area_person_entering_roi_rejected(self):
        # Person entering verified hazard zone must NOT trigger designated_area_violation
        cfg = BehaviourConfig(verified_hazard_zones=((100.0, 100.0, 600.0, 600.0),))
        person_pts = [
            TrackPoint(frame=f, x=200.0 + (f * 5.0), y=300.0, width=80.0, height=180.0, class_name="person")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=person_pts, all_tracks={1: person_pts}, video_name="wet_floor_video"
        )
        rule = DesignatedAreaRule(cfg)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_designated_area_stationary_carton_rejected(self):
        # Stationary carton inside hazard zone (net_dist = 0 < 60px) must be rejected
        cfg = BehaviourConfig(verified_hazard_zones=((100.0, 100.0, 600.0, 600.0),))
        stat_carton = [
            TrackPoint(frame=f, x=200.0, y=300.0, width=80.0, height=80.0, class_name="carton")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=stat_carton, all_tracks={2: stat_carton}, video_name="wet_floor_video"
        )
        rule = DesignatedAreaRule(cfg)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_designated_area_ordinary_carton_crossing_old_dock_rejected(self):
        # Ordinary carton crossing old dock x<=260 with default config (no verified zone)
        dock_carton = [
            TrackPoint(frame=f, x=180.0 + (f * 4.0), y=450.0, width=80.0, height=80.0, class_name="carton")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=3, target_points=dock_carton, all_tracks={3: dock_carton}, video_name="Dock level, dragging cupboard"
        )
        rule = DesignatedAreaRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_designated_area_video_names_do_not_enable_detection(self):
        # Video names containing "dock", "wet", or "floor" do not by themselves enable detection
        dock_carton = [
            TrackPoint(frame=f, x=180.0 + (f * 4.0), y=450.0, width=80.0, height=80.0, class_name="carton")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=3, target_points=dock_carton, all_tracks={3: dock_carton}, video_name="Rolling and dragging on wet floor"
        )
        rule = DesignatedAreaRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_designated_area_no_verified_hazard_zone_rejected(self):
        # Carton movement with NO verified hazard zone configured -> rejected
        carton = [
            TrackPoint(frame=f, x=100.0 + (f * 5.0), y=300.0, width=80.0, height=80.0, class_name="carton")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=4, target_points=carton, all_tracks={4: carton}, video_name="standard_video"
        )
        rule = DesignatedAreaRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_designated_area_non_carton_target_rejected(self):
        # Non-carton target (e.g. pallet) moving in verified hazard zone -> rejected
        cfg = BehaviourConfig(verified_hazard_zones=((100.0, 100.0, 600.0, 600.0),))
        pallet_pts = [
            TrackPoint(frame=f, x=200.0 + (f * 5.0), y=300.0, width=80.0, height=80.0, class_name="pallet")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=5, target_points=pallet_pts, all_tracks={5: pallet_pts}, video_name="standard_video"
        )
        rule = DesignatedAreaRule(cfg)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    # -------------------------------------------------------------------------
    # 8. Equipment Rule
    # -------------------------------------------------------------------------
    def test_equipment_rule_positive(self):
        # Heavy carton (area=350x350=122500 >= 100000) moved 100px with nearby worker
        carton = [
            TrackPoint(frame=f, x=300.0 + (f * 5.0), y=450.0, width=350.0, height=350.0, class_name="carton")
            for f in range(20)
        ]
        worker = [
            TrackPoint(frame=f, x=500.0 + (f * 5.0), y=450.0, width=80.0, height=200.0, class_name="person")
            for f in range(20)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=carton, all_tracks={1: carton, 2: worker}, video_name="general_video"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].behaviour_type, "equipment_violation")

    def test_equipment_rule_person_walking_rejected(self):
        # Person walking > 60px with large area must NOT trigger equipment_violation
        worker = [
            TrackPoint(frame=f, x=300.0 + (f * 5.0), y=450.0, width=150.0, height=250.0, class_name="person")
            for f in range(20)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=worker, all_tracks={1: worker}, video_name="general_video"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_equipment_rule_person_in_cupboard_video_rejected(self):
        # Person moving > 60px in a video with 'cupboard' in name must NOT trigger equipment_violation
        worker = [
            TrackPoint(frame=f, x=300.0 + (f * 5.0), y=450.0, width=150.0, height=250.0, class_name="person")
            for f in range(20)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=worker, all_tracks={1: worker}, video_name="Dock level, dragging cupboard"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_equipment_rule_small_carton_rejected(self):
        # Small background carton (area 12,000 px² < 100,000 px²) moving > 60px with worker
        carton = [
            TrackPoint(frame=f, x=300.0 + (f * 5.0), y=450.0, width=120.0, height=100.0, class_name="carton")
            for f in range(20)
        ]
        worker = [
            TrackPoint(frame=f, x=380.0 + (f * 5.0), y=450.0, width=80.0, height=200.0, class_name="person")
            for f in range(20)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=carton, all_tracks={1: carton, 2: worker}, video_name="general_video"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_equipment_rule_medium_carton_around_50k_rejected(self):
        # Standard carton (area 50,625 px² < 100,000 px²) moving > 60px with worker
        carton = [
            TrackPoint(frame=f, x=300.0 + (f * 5.0), y=450.0, width=225.0, height=225.0, class_name="carton")
            for f in range(20)
        ]
        worker = [
            TrackPoint(frame=f, x=450.0 + (f * 5.0), y=450.0, width=80.0, height=200.0, class_name="person")
            for f in range(20)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=carton, all_tracks={1: carton, 2: worker}, video_name="Rolling and dropping carton"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_equipment_rule_large_carton_without_nearby_worker_rejected(self):
        # Large carton (area 122,500 px² >= 100,000 px²) moving > 60px but NO worker nearby
        carton = [
            TrackPoint(frame=f, x=300.0 + (f * 5.0), y=450.0, width=350.0, height=350.0, class_name="carton")
            for f in range(20)
        ]
        worker_far = [
            TrackPoint(frame=f, x=800.0, y=450.0, width=80.0, height=200.0, class_name="person")
            for f in range(20)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=carton, all_tracks={1: carton, 2: worker_far}, video_name="general_video"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_equipment_rule_genuine_large_carton_with_nearby_worker_detected(self):
        # Genuine large carton (area 150,000 px²) manually dragged by adjacent worker
        carton = [
            TrackPoint(frame=f, x=400.0 + (f * 4.0), y=400.0, width=400.0, height=375.0, class_name="carton")
            for f in range(25)
        ]
        worker = [
            TrackPoint(frame=f, x=620.0 + (f * 4.0), y=400.0, width=80.0, height=200.0, class_name="person")
            for f in range(25)
        ]
        ctx = TrajectoryContext(
            target_object_id=1, target_points=carton, all_tracks={1: carton, 2: worker}, video_name="general_video"
        )
        rule = EquipmentRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].behaviour_type, "equipment_violation")
        self.assertEqual(candidates[0].object_id, 1)

    def test_equipment_rule_genuine_dock_cupboard_cases_detected(self):
        # Verify genuine cupboard tracks 182, 213, 272 from Dock level video are all detected
        import pandas as pd
        import os
        traj_file = os.path.join("data", "Trajectories", "Dock level, dragging cupboard_trajectories.csv")
        if os.path.exists(traj_file):
            df = pd.read_csv(traj_file)
            tracks = {}
            for oid, grp in df.groupby("object_id"):
                pts = [
                    TrackPoint(
                        frame=int(r["frame"]),
                        x=float(r["x"]),
                        y=float(r["y"]),
                        width=float(r["width"]),
                        height=float(r["height"]),
                        class_name=str(r["class"]),
                    )
                    for _, r in grp.iterrows()
                ]
                tracks[oid] = pts

            rule = EquipmentRule(self.config)
            for target_id in [182, 213, 272]:
                ctx = TrajectoryContext(
                    target_object_id=target_id,
                    target_points=tracks[target_id],
                    all_tracks=tracks,
                    video_name="Dock level, dragging cupboard",
                )
                cands = rule.evaluate(ctx)
                self.assertEqual(len(cands), 1, f"Carton {target_id} should be detected as equipment_violation")
                self.assertEqual(cands[0].behaviour_type, "equipment_violation")

    # -------------------------------------------------------------------------
    # 9. Sequence Rule (Stepping on Cartons)
    # -------------------------------------------------------------------------
    def test_sequence_rule_positive(self):
        # Person track standing on carton stack
        carton = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=80.0, class_name="carton") for f in range(20)]
        worker = [TrackPoint(frame=f, x=500.0, y=430.0, width=60.0, height=140.0, class_name="person") for f in range(20)]

        ctx = TrajectoryContext(
            target_object_id=2, target_points=worker, all_tracks={1: carton, 2: worker}, video_name="stepping_on_cartons"
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)

        self.assertGreater(len(candidates), 0)
        self.assertEqual(candidates[0].behaviour_type, "stepping_on_cartons")

    def test_sequence_rule_person_on_floor_rejected(self):
        # Normal worker walking/standing on floor without carton, even in stepping video with y < 350
        worker = [TrackPoint(frame=f, x=500.0, y=340.0, width=80.0, height=240.0, class_name="person") for f in range(20)]
        ctx = TrajectoryContext(
            target_object_id=1,
            target_points=worker,
            all_tracks={1: worker},
            video_name="Stepping on cartons, vertical product kept horizontally, heavy product kept on top",
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_sequence_rule_person_walking_near_carton_rejected(self):
        # Person walking nearby horizontally separated from carton
        carton = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=80.0, class_name="carton") for f in range(20)]
        worker = [TrackPoint(frame=f, x=700.0, y=430.0, width=60.0, height=140.0, class_name="person") for f in range(20)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=worker, all_tracks={1: carton, 2: worker}, video_name="normal_handling"
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_sequence_rule_background_person_aligned_in_2d_rejected(self):
        # Distant background worker (tiny scale h=40) projecting in 2D over foreground carton (h=100)
        carton = [TrackPoint(frame=f, x=500.0, y=400.0, width=100.0, height=100.0, class_name="carton") for f in range(20)]
        worker = [TrackPoint(frame=f, x=500.0, y=330.0, width=20.0, height=40.0, class_name="person") for f in range(20)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=worker, all_tracks={1: carton, 2: worker}, video_name="warehouse_dock"
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_sequence_rule_carton_as_target_rejected(self):
        # Carton resting on top of another carton (stack) must NOT trigger stepping_on_cartons
        base_carton = [TrackPoint(frame=f, x=500.0, y=550.0, width=100.0, height=80.0, class_name="carton") for f in range(20)]
        top_carton = [TrackPoint(frame=f, x=500.0, y=470.0, width=100.0, height=80.0, class_name="carton") for f in range(20)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=top_carton, all_tracks={1: base_carton, 2: top_carton}, video_name="carton_stacking"
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_sequence_rule_person_over_non_carton_rejected(self):
        # Fragmented person tracking: upper torso (person) above legs (person) must be rejected
        legs = [TrackPoint(frame=f, x=500.0, y=550.0, width=60.0, height=100.0, class_name="person") for f in range(20)]
        torso = [TrackPoint(frame=f, x=500.0, y=450.0, width=60.0, height=100.0, class_name="person") for f in range(20)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=torso, all_tracks={1: legs, 2: torso}, video_name="occluded_person"
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 0)

    def test_sequence_rule_genuine_person_on_carton_detected(self):
        # Genuine worker standing on stationary carton
        carton = [TrackPoint(frame=f, x=600.0, y=500.0, width=120.0, height=100.0, class_name="carton") for f in range(20)]
        worker = [TrackPoint(frame=f, x=600.0, y=350.0, width=70.0, height=200.0, class_name="person") for f in range(20)]
        ctx = TrajectoryContext(
            target_object_id=2, target_points=worker, all_tracks={1: carton, 2: worker}, video_name="genuine_stepping"
        )
        rule = SequenceRule(self.config)
        candidates = rule.evaluate(ctx)
        self.assertEqual(len(candidates), 1)
        self.assertEqual(candidates[0].behaviour_type, "stepping_on_cartons")
        self.assertEqual(candidates[0].object_id, 2)
        self.assertEqual(candidates[0].evidence["supporting_carton_id"], 1)


if __name__ == "__main__":
    unittest.main()

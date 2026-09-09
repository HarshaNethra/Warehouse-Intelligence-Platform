"""
Unit tests for behaviour_engine/motion.py.
"""

import unittest
from behaviour_engine.motion import (
    TrackPoint,
    detect_sudden_impact,
    frame_displacement,
    instantaneous_velocities,
    is_stationary,
    movement_direction_angle,
    net_displacement,
    sanitize_track,
    total_distance_traveled,
    track_accelerations,
    track_velocity,
)


class TestMotion(unittest.TestCase):

    def test_sanitize_track(self):
        pts = [
            TrackPoint(frame=5, x=10.0, y=20.0, width=30.0, height=40.0),
            TrackPoint(frame=1, x=float("nan"), y=20.0, width=30.0, height=40.0),
            TrackPoint(frame=2, x=15.0, y=25.0, width=30.0, height=40.0),
        ]
        clean = sanitize_track(pts)
        self.assertEqual(len(clean), 2)
        self.assertEqual(clean[0].frame, 2)
        self.assertEqual(clean[1].frame, 5)

    def test_displacement_and_velocity(self):
        p1 = TrackPoint(frame=0, x=100.0, y=200.0, width=50.0, height=50.0)
        p2 = TrackPoint(frame=30, x=200.0, y=200.0, width=50.0, height=50.0)

        dx, dy, dist = frame_displacement(p1, p2)
        self.assertEqual(dx, 100.0)
        self.assertEqual(dy, 0.0)
        self.assertEqual(dist, 100.0)

        # dt = 30 frames / 30 fps = 1.0 s -> vx = 100 px/s
        vx, vy, speed = track_velocity(p1, p2, fps=30.0)
        self.assertAlmostEqual(vx, 100.0)
        self.assertAlmostEqual(vy, 0.0)
        self.assertAlmostEqual(speed, 100.0)

    def test_total_distance_and_net_displacement(self):
        # Moves out 100px and returns 100px
        pts = [
            TrackPoint(frame=0, x=0.0, y=0.0, width=10.0, height=10.0),
            TrackPoint(frame=10, x=100.0, y=0.0, width=10.0, height=10.0),
            TrackPoint(frame=20, x=0.0, y=0.0, width=10.0, height=10.0),
        ]
        self.assertAlmostEqual(total_distance_traveled(pts), 200.0)
        ndx, ndy, ndist = net_displacement(pts)
        self.assertAlmostEqual(ndist, 0.0)

    def test_accelerations_and_impact(self):
        # Points showing rapid acceleration then sudden jarring stop
        # Frame 0 to 5: v = 0 px/s
        # Frame 5 to 10: rapid move to x=300 (v = 1800 px/s)
        # Frame 10 to 15: stops completely at x=300 (v = 0 px/s) -> sharp deceleration
        pts = [
            TrackPoint(frame=0, x=0.0, y=0.0, width=10.0, height=10.0),
            TrackPoint(frame=5, x=0.0, y=0.0, width=10.0, height=10.0),
            TrackPoint(frame=10, x=300.0, y=0.0, width=10.0, height=10.0),
            TrackPoint(frame=15, x=300.0, y=0.0, width=10.0, height=10.0),
        ]
        has_impact, max_decel = detect_sudden_impact(pts, decel_threshold_px_s2=500.0, fps=30.0)
        self.assertTrue(has_impact)
        self.assertGreater(max_decel, 500.0)

    def test_is_stationary(self):
        # Stationary track (tiny 2px jitter)
        pts_stationary = [
            TrackPoint(frame=i, x=100.0 + (i % 2), y=200.0, width=50.0, height=50.0)
            for i in range(10)
        ]
        self.assertTrue(is_stationary(pts_stationary, max_displacement_px=10.0, max_speed_px_s=40.0, fps=30.0))

        # Fast moving track
        pts_moving = [
            TrackPoint(frame=i, x=100.0 + (i * 20.0), y=200.0, width=50.0, height=50.0)
            for i in range(10)
        ]
        self.assertFalse(is_stationary(pts_moving, max_displacement_px=10.0, max_speed_px_s=40.0, fps=30.0))

    def test_movement_direction(self):
        p1 = TrackPoint(frame=0, x=100.0, y=100.0, width=10.0, height=10.0)
        p_east = TrackPoint(frame=1, x=200.0, y=100.0, width=10.0, height=10.0)
        p_south = TrackPoint(frame=1, x=100.0, y=200.0, width=10.0, height=10.0)

        self.assertAlmostEqual(movement_direction_angle(p1, p_east), 0.0)
        self.assertAlmostEqual(movement_direction_angle(p1, p_south), 90.0)


if __name__ == "__main__":
    unittest.main()

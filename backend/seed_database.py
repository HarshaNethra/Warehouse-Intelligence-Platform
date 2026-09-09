"""
Canonical Database Reset & Seed Script for Unified Godrej Warehouse Intelligence Platform.

Performs:
1. Clears stale demo/mock events, risk assessments, observations, and inference runs.
2. Removes stale non-canonical video records (e.g. random UUIDs, sample.mp4).
3. Executes init_db() to seed organization, facility, loading bays, cameras, safety rules, shifts, and user accounts.
4. Executes canonical Member 2 Behaviour + Risk pipeline across all 7 warehouse trajectory CSVs.
5. Persists events via EventAdapter with 3-layer relational integrity.
6. Verifies deterministic 22-event baseline (15 High, 7 Medium, 0 Critical, 0 Low).
"""

import sys
import uuid
import json
from pathlib import Path

backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent if (backend_dir.parent / "behaviour_engine").exists() else backend_dir
for p in [backend_dir, project_root]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from app.db.database import SessionLocal, engine, Base
from app.db import models
from app.db.seed import init_db
from behaviour_engine.rule_engine import RuleEngine
from risk_engine.pipeline import score_and_build_events
from app.services.event_adapter import event_adapter, WAREHOUSE_VIDEO_METADATA
from app.api.pipeline import resolve_trajectories_dir


def reset_and_seed():
    print("=" * 75)
    print("UNIFIED GODREJ PLATFORM — CANONICAL DATABASE RESET & INGESTION")
    print("=" * 75)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Step 1: Count existing state before cleanup
        old_evt_count = db.query(models.Event).count()
        old_ra_count = db.query(models.RiskAssessment).count()
        old_obs_count = db.query(models.BehaviourObservation).count()
        old_run_count = db.query(models.InferenceRun).count()
        old_vid_count = db.query(models.Video).count()
        print(f"[1/5] Current database state before reset:")
        print(f"      - Events:                 {old_evt_count}")
        print(f"      - Risk Assessments:       {old_ra_count}")
        print(f"      - Behaviour Observations: {old_obs_count}")
        print(f"      - Inference Runs:         {old_run_count}")
        print(f"      - Videos:                 {old_vid_count}")

        # Step 2: Remove all events, risk assessments, observations, and inference runs
        print("\n[2/5] Purging stale demo and historical records...")
        db.query(models.Event).delete()
        db.query(models.RiskAssessment).delete()
        db.query(models.BehaviourObservation).delete()
        db.query(models.InferenceRun).delete()

        # Remove non-canonical videos (retain or let init_db re-create canonical 7)
        canonical_vids = {
            f"VID-{uuid.uuid5(uuid.NAMESPACE_DNS, stem).hex[:8].upper()}"
            for stem in WAREHOUSE_VIDEO_METADATA.keys()
        }
        for v in db.query(models.Video).all():
            if v.video_id not in canonical_vids:
                print(f"      - Removing non-canonical video: {v.video_id} ({v.filename})")
                db.delete(v)
        db.commit()

        # Step 3: Run init_db() to ensure org, facilities, bays, cameras, rules, users, and canonical videos exist
        print("\n[3/5] Running init_db() infrastructure initialization...")
        init_db(db)

        # Step 4: Run canonical trajectory ingestion for all 7 warehouse videos
        print("\n[4/5] Executing canonical Member 2 Behaviour + Risk pipeline across warehouse trajectories...")
        traj_dir = resolve_trajectories_dir()
        csv_files = sorted([f for f in traj_dir.glob("*.csv") if f.is_file()])
        print(f"      Found {len(csv_files)} trajectory CSV files in {traj_dir}")

        engine_be = RuleEngine()
        total_ingested = 0
        per_video_counts = {}

        for c_path in csv_files:
            clean_stem = c_path.stem.replace("_trajectories", "")
            tracks = engine_be.parse_trajectory_csv(c_path)
            candidates = engine_be.process_tracks(tracks, fps=30.0, video_name=clean_stem)
            canonical_events = score_and_build_events(candidates, video_id=clean_stem, fps=30.0)

            persisted = event_adapter.adapt_and_persist_events(
                db=db,
                root_events=canonical_events,
                video_name_or_id=clean_stem,
                fps=30.0,
                provenance_type="REAL_INFERENCE",
                environment="PRODUCTION"
            )
            count = len(persisted)
            total_ingested += count
            per_video_counts[clean_stem] = count

            high_count = sum(1 for e in persisted if e.risk_level == "HIGH")
            med_count = sum(1 for e in persisted if e.risk_level == "MEDIUM")
            crit_count = sum(1 for e in persisted if e.risk_level == "CRITICAL")
            low_count = sum(1 for e in persisted if e.risk_level == "LOW")

            print(f"      * {clean_stem}:")
            print(f"        -> {count} events (High: {high_count}, Medium: {med_count}, Critical: {crit_count}, Low: {low_count})")

        # Step 5: Verification of canonical state
        print("\n[5/5] Verifying canonical baseline integrity...")
        final_events = db.query(models.Event).all()
        new_total = len(final_events)
        high_total = sum(1 for e in final_events if e.risk_level == "HIGH")
        med_total = sum(1 for e in final_events if e.risk_level == "MEDIUM")
        crit_total = sum(1 for e in final_events if e.risk_level == "CRITICAL")
        low_total = sum(1 for e in final_events if e.risk_level == "LOW")

        # Check duplicates
        event_ids = [e.event_id for e in final_events]
        unique_event_ids = set(event_ids)
        duplicate_count = len(event_ids) - len(unique_event_ids)

        print("-" * 75)
        print(f"CANONICAL INGESTION VERIFICATION RESULT:")
        print(f"  - Total Events:            {new_total} (Expected: 22)")
        print(f"  - High Risk Events:        {high_total} (Expected: 15)")
        print(f"  - Medium Risk Events:      {med_total} (Expected: 7)")
        print(f"  - Critical Events:         {crit_total} (Expected: 0)")
        print(f"  - Low Risk Events:         {low_total} (Expected: 0)")
        print(f"  - Duplicate Event IDs:     {duplicate_count} (Expected: 0)")
        print("-" * 75)

        assert new_total == 22, f"Expected 22 total events, got {new_total}"
        assert high_total == 15, f"Expected 15 high risk events, got {high_total}"
        assert med_total == 7, f"Expected 7 medium risk events, got {med_total}"
        assert crit_total == 0, f"Expected 0 critical events, got {crit_total}"
        assert low_total == 0, f"Expected 0 low risk events, got {low_total}"
        assert duplicate_count == 0, f"Found {duplicate_count} duplicate event IDs"

        # Check video distribution
        dock_count = per_video_counts.get("Dock level, dragging cupboard", 0)
        kd_count = per_video_counts.get("KD packets dragged, heavy box kept on other packets", 0)
        throw_count = per_video_counts.get("Throwing seating cartons, using strap to hold", 0)

        assert dock_count == 10, f"Expected 10 events for Dock level, got {dock_count}"
        assert kd_count == 11, f"Expected 11 events for KD packets, got {kd_count}"
        assert throw_count == 1, f"Expected 1 event for Throwing seating cartons, got {throw_count}"

        print("ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!")
        print("Database warehouse.db is now in the clean, canonical 22-event state.")

    finally:
        db.close()


if __name__ == "__main__":
    reset_and_seed()

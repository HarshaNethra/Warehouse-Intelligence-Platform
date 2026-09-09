[Warehouse_AI_Video_Intelligence_PRD.md](https://github.com/user-attachments/files/31843603/Warehouse_AI_Video_Intelligence_PRD.md)
# AI Video Intelligence for Warehouse Handling --- Project PRD

**Document Type:** Product Requirements Document + Technical
Implementation Plan\
**Project:** AI-Powered Field Intelligence Assistant for Safer,
Damage-Free Warehouse Operations\
**Target Prototype:** Web application\
**Primary Stack:** React 19 + TypeScript + Vite + Tailwind CSS / Python 3.13 + FastAPI
/ Ultralytics YOLO11s / ByteTrack / Roboflow Universe / SQLite & Supabase PostgreSQL / Google Gemini 2.5 Flash\
**Deployment & Hosting:** Vercel (Frontend) + Render (Backend) + Supabase (Database)\
**Version Control:** Git + GitHub

------------------------------------------------------------------------

# 1. Product Overview

## 1.1 Product Vision

Build an AI-powered video intelligence platform that converts warehouse
loading/unloading video into structured operational intelligence.

The system should:

1.  Ingest recorded warehouse video.
2.  Detect relevant objects such as people, cartons/products and
    pallets.
3.  Track objects across frames.
4.  Convert tracked movement into temporal behaviour signals.
5.  Detect predefined damage-causing or risk-indicating behaviours.
6.  Assign an explainable risk score and risk level.
7.  Store detected incidents as structured events.
8.  Present video evidence, events, risk levels and trends in a
    supervisor-facing dashboard.
9.  Provide a conversational AI assistant that answers questions using
    the detected event data.
10. Support prevention-oriented decisions rather than simply reporting
    confirmed damage.

The challenge emphasizes moving from:

`Camera → Recording → Human review → Incident discovered`

to:

`Camera → AI perception → Behaviour understanding → Risk detection → Alert → Intervention → Learning`

------------------------------------------------------------------------

# 2. Problem Statement

Warehouse product damage can result from inappropriate handling
behaviour, including:

-   Dropping
-   Dragging
-   Rough handling
-   Improper or unstable stacking
-   Throwing
-   Unsafe movement
-   Incorrect pallet placement
-   Improper loading/unloading sequence
-   Other handling practices that can create damage risk

Traditional CCTV primarily records events. The proposed system should
interpret what is happening and surface potentially risky behaviour
early.

------------------------------------------------------------------------

# 3. Product Goals

## 3.1 Primary Goals

-   Demonstrate reliable object detection and tracking on the provided
    sample footage.
-   Demonstrate at least 10 predefined behaviours/scenarios in the
    prototype where practical.
-   Convert object trajectories into behaviour events using explainable
    temporal rules.
-   Assign every detected event a risk score and risk level.
-   Provide evidence for every important event.
-   Allow supervisors to filter, inspect and understand incidents.
-   Provide an AI assistant grounded in the event database.
-   Demonstrate the distinction between:
    -   Observed behaviour
    -   Potential risk
    -   Confirmed damage
-   Produce an end-to-end pipeline from video input to dashboard output
    without manual data transformation.

## 3.2 Secondary Goals

-   Provide behaviour and risk trends.
-   Identify recurring risky behaviours.
-   Identify high-risk locations/bays.
-   Provide corrective-action recommendations.
-   Provide user validation and measurable performance results.
-   Keep the system focused on process improvement rather than
    indiscriminate employee surveillance.

------------------------------------------------------------------------

# 4. Non-Goals / Scope Control

The first prototype does NOT need to:

-   Train a computer-vision model from scratch.
-   Implement deep-learning action recognition.
-   Prove that physical product damage definitely occurred.
-   Build a production-scale cloud infrastructure.
-   Implement full warehouse-management-system integration.
-   Implement multi-camera identity tracking unless time permits.
-   Build a complex enterprise authentication system unless required for
    the demonstration.
-   Automatically punish or score individual employees.

The current project direction uses rule-based temporal logic rather than
deep-learning action recognition because it is more achievable and
explainable for the prototype.

------------------------------------------------------------------------

# 5. Target Users

## Primary User

### Warehouse Supervisor

Needs to:

-   See what risky events occurred.
-   Understand why an event was considered risky.
-   Locate the event in the video.
-   Identify recurring behaviour.
-   Compare risk across shifts/bays.
-   Ask questions about incidents through the AI assistant.
-   Decide what corrective action or training may be required.

## Secondary Users

-   Loading/unloading operator
-   Logistics manager
-   Quality professional
-   Safety professional

------------------------------------------------------------------------

# 6. Core User Journey

``` text
Warehouse Activity
       ↓
Video Input
       ↓
Video Processing
       ↓
Object Detection
       ↓
Object Tracking
       ↓
Trajectory Generation
       ↓
Behaviour Detection
       ↓
Risk Scoring
       ↓
Event Storage
       ↓
FastAPI
       ↓
React Dashboard
       ↓
Supervisor Investigation
       ↓
Claude Assistant
       ↓
Explanation / Recommendation
       ↓
Corrective Intervention
       ↓
Damage Prevention
```

------------------------------------------------------------------------

# 7. Functional Requirements

## FR-01 --- Video Ingestion

The system shall accept recorded warehouse video.

Minimum expected input:

-   MP4 or another supported video format.
-   Sample videos supplied for the pilot.

The system should obtain:

-   Frame count
-   FPS
-   Width
-   Height
-   Duration

These values must be retained because trajectory calculations depend on
frame/time relationships.

------------------------------------------------------------------------

# 8. Object Detection Requirements

The CV pipeline shall detect relevant objects.

Initial candidate classes:

-   Person
-   Carton / cardboard box
-   Product
-   Pallet

The implementation may initially evaluate YOLO-World with text prompts.
If the accuracy is insufficient, the team may fine-tune a YOLO model
using a small curated dataset through Google Colab.

------------------------------------------------------------------------

# 9. Object Tracking Requirements

The system shall maintain a consistent object ID across frames.

Each trajectory record should contain enough information for downstream
behaviour analysis.

Recommended logical fields:

``` text
frame_id
timestamp
object_id
class_name
confidence
x
y
width
height
center_x
center_y
```

The exact schema must be finalized by the CV and Behaviour/Risk owners
before integration.

------------------------------------------------------------------------

# 10. Behaviour Detection Requirements

Behaviour detection shall use temporal information rather than a
single-frame classification.

Candidate behaviours:

1.  Product dropped
2.  Product dragged
3.  Rough handling / excessive impact
4.  Product thrown
5.  Improper stacking
6.  Unstable stacking
7.  Product outside designated area
8.  Product handled without required equipment
9.  Incorrect pallet positioning
10. Unsafe loading/unloading sequence

The final set must be validated against the actual available footage.

Each rule must have:

-   Behaviour name
-   Input signals
-   Detection conditions
-   Thresholds
-   Minimum duration where relevant
-   Cooldown/de-duplication logic
-   Evidence requirements
-   Risk calculation inputs

------------------------------------------------------------------------

# 11. Risk Scoring Requirements

Each behaviour event shall receive:

-   Numeric risk score
-   Risk level
-   Explanation

Risk levels:

``` text
Low
Medium
High
Critical
```

The scoring system should consider, where measurable:

-   Behaviour type
-   Drop height
-   Approximate impact
-   Duration of improper handling
-   Stacking configuration
-   Frequency of repeated behaviour
-   Location
-   Historical incident patterns

The exact numerical weights are implementation decisions and must be
documented and validated against the footage.

Example conceptual model:

``` text
Base Behaviour Severity
        +
Impact Factor
        +
Height Factor
        +
Duration Factor
        +
Frequency Factor
        +
Location Factor
        ↓
Final Risk Score
        ↓
Risk Level
```

The system must be able to answer:

> Why was this event classified as High/Critical?

without relying on a black-box explanation.

------------------------------------------------------------------------

# 12. Event Model Requirements

A detected event should contain at minimum:

``` text
event_id
video_id
timestamp
camera_id / bay_id if available
object_id
behaviour
risk_score
risk_level
description
reason
evidence_frame
video_reference
recommended_action
```

Optional fields:

``` text
start_timestamp
end_timestamp
confidence
drop_height
impact_estimate
duration
location
related_object_ids
```

The event schema is a critical integration contract between:

`Behaviour Engine → Backend → Database → API → Frontend → AI Assistant`

It must be finalized before parallel development.

------------------------------------------------------------------------

# 13. Dashboard Requirements

The React dashboard shall provide:

## Overview

-   Total events
-   High-risk events
-   Critical events
-   Behaviour counts
-   Risk distribution

## Video

-   Video playback
-   Detection/tracking overlays where available
-   Event timestamp navigation
-   Evidence frame

## Event Timeline

Each event should display:

-   Timestamp
-   Behaviour
-   Risk level
-   Risk score
-   Short description

## Filters

At minimum:

-   Risk level
-   Behaviour type

Potential filters:

-   Date
-   Shift
-   Loading bay
-   Camera

## Analytics

-   Events by behaviour
-   Events by risk level
-   Events over time
-   Events by bay/location
-   Repeated behaviours

## Incident Details

Selecting an event should show:

-   What happened
-   When it happened
-   Risk level
-   Score
-   Why it was flagged
-   Evidence
-   Recommended action

## AI Assistant

A chat interface shall allow supervisor questions about detected events.

------------------------------------------------------------------------

# 14. Backend Requirements

The backend shall be implemented in Python using FastAPI.

Responsibilities:

-   Receive frontend requests.
-   Query SQLite.
-   Return event data.
-   Return analytics.
-   Serve incident information.
-   Connect the assistant to event data.
-   Call Claude API.
-   Keep the assistant grounded in retrieved event data.

Suggested endpoints:

``` text
GET  /api/health
GET  /api/videos
GET  /api/events
GET  /api/events/{event_id}
GET  /api/analytics/summary
GET  /api/analytics/behaviours
GET  /api/analytics/risk
GET  /api/analytics/timeline
POST /api/assistant/chat
```

Exact endpoint names may be adjusted during implementation, but the API
contract must be documented.

------------------------------------------------------------------------

# 15. AI Assistant Requirements

The assistant must not independently invent incident information.

Required flow:

``` text
Supervisor Question
       ↓
FastAPI
       ↓
Determine relevant query
       ↓
SQLite
       ↓
Relevant Event Records
       ↓
Claude API
       ↓
Grounded Answer
       ↓
React
```

Example questions:

-   Show me all high-risk handling events from today's unloading.
-   What were the three most common risky behaviours?
-   Which loading bay had the highest number of risky events?
-   Why was this event classified as high risk?
-   What corrective action is recommended?
-   Summarize the morning shift.

The backend should provide Claude only the information necessary to
answer the question.

------------------------------------------------------------------------

# 16. Data Storage Requirements

SQLite shall be the initial database.

Logical entities:

``` text
videos
events
```

Optional:

``` text
objects
behaviour_rules
risk_rules
```

Do not over-engineer the database for the prototype.

The event data should remain structured enough for SQL analytics and
assistant grounding.

------------------------------------------------------------------------

# 17. Responsible AI Requirements

The prototype shall:

-   Focus on behaviours/events rather than individual employee
    punishment.
-   Avoid automatic punitive decisions.
-   Require human review for significant incidents.
-   Distinguish observed behaviour from potential damage.
-   Avoid claiming confirmed damage without sufficient evidence.
-   Minimize retained data.
-   Document retention assumptions.
-   Consider privacy and authorization for real warehouse footage.
-   Make risk explanations understandable.
-   Track false positives and validation results.

------------------------------------------------------------------------

# 18. Performance / Success Metrics

## AI Performance

-   Behaviour detection accuracy
-   Precision
-   Recall
-   False-positive rate
-   Detection latency

## Operational Performance

-   High-risk events per shift
-   Repeat behaviour frequency
-   Average response time
-   Risk events by loading bay

## Business Impact

-   Potential damage events prevented
-   Reduction in handling-related incidents
-   Reduction in product damage
-   Reduction in rework/replacement
-   Estimated financial impact

## Human Impact

-   Supervisor usability
-   Operator acceptance
-   Training opportunities identified
-   User feedback score

For the prototype, prioritize metrics that can actually be measured from
the available footage.

------------------------------------------------------------------------

# 19. Technical Architecture

``` text
                         ┌─────────────────────┐
                         │ Warehouse Video     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ OpenCV              │
                         │ Video Processing    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ YOLO / YOLO-World   │
                         │ Object Detection    │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ ByteTrack           │
                         │ Object Tracking     │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Trajectory Data     │
                         │ CSV / JSON          │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Behaviour Engine    │
                         │ Python Rules        │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ Risk Engine         │
                         │ Python Scoring      │
                         └──────────┬──────────┘
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │ FastAPI Backend     │
                         │ Python              │
                         └──────┬────────┬─────┘
                                │        │
                       ┌────────┘        └─────────┐
                       ▼                          ▼
                ┌─────────────┐            ┌─────────────┐
                │ SQLite      │            │ Claude API  │
                │ Event DB    │            │ Assistant   │
                └──────┬──────┘            └──────┬──────┘
                       │                          │
                       └──────────┬───────────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ REST / JSON API     │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ React + TypeScript  │
                       │ Tailwind CSS        │
                       └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ Supervisor          │
                       │ Dashboard           │
                       └─────────────────────┘
```

------------------------------------------------------------------------

# 20. Repository Structure

``` text
warehouse-ai-video-intelligence/
│
├── README.md
├── PRD.md
├── .gitignore
├── .env.example
├── docker-compose.yml                 # Optional
│
├── docs/
│   ├── architecture.md
│   ├── api-contract.md
│   ├── event-schema.md
│   ├── behaviour-rules.md
│   ├── risk-scoring.md
│   ├── validation-report.md
│   └── demo-script.md
│
├── data/
│   ├── raw/
│   │   └── .gitkeep
│   ├── processed/
│   │   └── .gitkeep
│   ├── trajectories/
│   │   └── .gitkeep
│   ├── events/
│   │   └── .gitkeep
│   └── database/
│       └── .gitkeep
│
├── models/
│   ├── README.md
│   └── .gitkeep
│
├── cv_pipeline/
│   ├── __init__.py
│   ├── config.py
│   ├── video_reader.py
│   ├── detector.py
│   ├── tracker.py
│   ├── trajectory.py
│   ├── annotations.py
│   ├── pipeline.py
│   └── run_pipeline.py
│
├── behaviour_engine/
│   ├── __init__.py
│   ├── config.py
│   ├── geometry.py
│   ├── motion.py
│   ├── temporal.py
│   ├── base_rule.py
│   ├── drop_rule.py
│   ├── drag_rule.py
│   ├── rough_handling_rule.py
│   ├── throw_rule.py
│   ├── stacking_rule.py
│   ├── unstable_stack_rule.py
│   ├── designated_area_rule.py
│   ├── equipment_rule.py
│   ├── pallet_rule.py
│   ├── sequence_rule.py
│   ├── rule_engine.py
│   └── event_builder.py
│
├── risk_engine/
│   ├── __init__.py
│   ├── config.py
│   ├── severity.py
│   ├── factors.py
│   ├── scorer.py
│   ├── classifier.py
│   └── explanation.py
│
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── config.py
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── health.py
│   │   │   ├── videos.py
│   │   │   ├── events.py
│   │   │   ├── analytics.py
│   │   │   └── assistant.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── event.py
│   │   │   ├── video.py
│   │   │   ├── analytics.py
│   │   │   └── assistant.py
│   │   │
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── database.py
│   │   │   ├── models.py
│   │   │   └── repository.py
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── event_service.py
│   │   │   ├── analytics_service.py
│   │   │   └── assistant_service.py
│   │   │
│   │   └── integrations/
│   │       ├── __init__.py
│   │       └── claude_client.py
│   │
│   ├── requirements.txt
│   └── run.py
│
├── frontend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/
│       │   ├── client.ts
│       │   ├── events.ts
│       │   ├── videos.ts
│       │   ├── analytics.ts
│       │   └── assistant.ts
│       │
│       ├── types/
│       │   ├── event.ts
│       │   ├── video.ts
│       │   ├── analytics.ts
│       │   └── assistant.ts
│       │
│       ├── components/
│       │   ├── VideoPlayer.tsx
│       │   ├── EventTimeline.tsx
│       │   ├── EventList.tsx
│       │   ├── EventDetails.tsx
│       │   ├── RiskBadge.tsx
│       │   ├── SummaryCards.tsx
│       │   ├── BehaviourChart.tsx
│       │   ├── RiskChart.tsx
│       │   ├── Filters.tsx
│       │   └── AssistantChat.tsx
│       │
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   └── Incident.tsx
│       │
│       └── hooks/
│           ├── useEvents.ts
│           ├── useAnalytics.ts
│           └── useAssistant.ts
│
├── tests/
│   ├── cv/
│   ├── behaviour/
│   ├── risk/
│   ├── backend/
│   └── frontend/
│
└── scripts/
    ├── run_detection.py
    ├── generate_trajectories.py
    ├── generate_events.py
    ├── import_events.py
    └── seed_database.py
```

------------------------------------------------------------------------

# 21. High-Level Development Phases

The project should be developed in the following order.

## Phase 0 --- Contract & Planning

Define the interfaces between all team members.

Outputs:

-   Final behaviour list
-   Trajectory schema
-   Event schema
-   Risk-scoring specification
-   API specification
-   Repository structure
-   Development responsibilities

**This phase is mandatory before everyone works independently.**

------------------------------------------------------------------------

## Phase 1 --- Video + CV Pipeline

Build:

``` text
Video → OpenCV → YOLO → ByteTrack → Trajectories
```

Outputs:

-   Detection
-   Tracking
-   Annotated video
-   Trajectory CSV/JSON

Owner: Member 1

------------------------------------------------------------------------

## Phase 2 --- Behaviour Intelligence

Build:

``` text
Trajectories → Temporal Rules → Behaviour Events
```

Outputs:

-   Behaviour rules
-   Thresholds
-   Event generation
-   Ground-truth comparison

Owner: Member 2 + Member 5

------------------------------------------------------------------------

## Phase 3 --- Risk Scoring

Build:

``` text
Behaviour Event → Factors → Score → Risk Level → Explanation
```

Outputs:

-   Risk formula
-   Severity table
-   Risk classifier
-   Explainable score

Owner: Member 2

------------------------------------------------------------------------

## Phase 4 --- Backend + Database

Build:

``` text
Events → SQLite → FastAPI → REST API
```

Outputs:

-   Database
-   Repository layer
-   API schemas
-   Event endpoints
-   Analytics endpoints

Owner: Member 4

------------------------------------------------------------------------

## Phase 5 --- Frontend

Build:

``` text
FastAPI → React → Dashboard
```

Outputs:

-   Dashboard
-   Video player
-   Event timeline
-   Risk cards
-   Filters
-   Charts
-   Incident details

Owner: Member 3

------------------------------------------------------------------------

## Phase 6 --- AI Assistant

Build:

``` text
Question → API → Database Query → Claude → Grounded Answer
```

Outputs:

-   Assistant service
-   Claude integration
-   Chat API
-   Chat UI
-   Grounding tests

Owner: Member 4 + Member 3

------------------------------------------------------------------------

## Phase 7 --- End-to-End Integration

Connect everything:

``` text
Video
 ↓
CV
 ↓
Behaviour
 ↓
Risk
 ↓
SQLite
 ↓
FastAPI
 ↓
React
 ↓
Assistant
```

Owner: All technical members

------------------------------------------------------------------------

## Phase 8 --- Validation & Tuning

Measure:

-   Precision
-   Recall
-   False positives
-   False negatives
-   Risk-score reasonableness
-   Detection latency
-   UI usability
-   Assistant correctness

Owner: Member 5 + Member 2, with all developers fixing issues.

------------------------------------------------------------------------

## Phase 9 --- Demo & Presentation

Prepare:

-   Final dashboard
-   Representative incidents
-   Demo video
-   Architecture diagram
-   Metrics
-   User validation
-   Responsible-AI explanation
-   5--6 slide presentation

Owner: Member 5 + all members supplying evidence.

------------------------------------------------------------------------

# 22. Phase 0 --- File-Level Implementation Plan

## `README.md`

### Implement

-   Project purpose
-   Setup instructions
-   Architecture overview
-   How to run CV pipeline
-   How to run backend
-   How to run frontend
-   Environment variables
-   Example workflow

### Verify

-   Every command matches the actual repository.
-   Backend and frontend setup instructions work on a clean machine.
-   Paths match actual directory structure.

------------------------------------------------------------------------

## `docs/event-schema.md`

### Implement

Define the canonical event structure.

Example:

``` json
{
  "event_id": "EVT-001",
  "video_id": "video_01",
  "timestamp": 42.7,
  "object_id": 17,
  "behaviour": "product_dropped",
  "risk_score": 87,
  "risk_level": "critical",
  "description": "...",
  "reason": "...",
  "evidence_frame": "..."
}
```

### Verify

This schema must be compatible with:

``` text
behaviour_engine/event_builder.py
risk_engine/scorer.py
backend/app/schemas/event.py
backend/app/db/models.py
frontend/src/types/event.ts
```

No team member should independently invent another event format.

------------------------------------------------------------------------

## `docs/behaviour-rules.md`

### Implement

For each behaviour:

-   Definition
-   Required objects
-   Required trajectory signals
-   Thresholds
-   Temporal conditions
-   Evidence requirements
-   Expected false positives
-   Risk inputs

### Verify

Every rule listed here must have:

``` text
one implementation file
+
one test scenario
+
one output event format
```

------------------------------------------------------------------------

## `docs/risk-scoring.md`

### Implement

Define:

-   Base severity
-   Factors
-   Weights
-   Score calculation
-   Risk-level boundaries
-   Explanation generation

### Verify

The scoring specification must match:

``` text
risk_engine/config.py
risk_engine/factors.py
risk_engine/scorer.py
risk_engine/classifier.py
risk_engine/explanation.py
```

------------------------------------------------------------------------

## `docs/api-contract.md`

### Implement

Document:

-   Endpoint
-   HTTP method
-   Parameters
-   Request body
-   Response body
-   Error format

### Verify

API documentation must match:

``` text
backend/app/api/*
backend/app/schemas/*
frontend/src/api/*
frontend/src/types/*
```

------------------------------------------------------------------------

# 23. Phase 1 --- CV Pipeline File-Level Plan

## `cv_pipeline/config.py`

### Implement

Central CV configuration:

-   Model path
-   Model type
-   Confidence threshold
-   IoU threshold if required
-   Target classes
-   Tracker configuration
-   Input/output paths

### Verify

No hard-coded model paths should exist in:

``` text
detector.py
tracker.py
pipeline.py
```

------------------------------------------------------------------------

## `cv_pipeline/video_reader.py`

### Implement

Create a video abstraction around OpenCV.

Responsibilities:

-   Open video
-   Read frames
-   Extract FPS
-   Extract resolution
-   Extract frame count
-   Convert frame number ↔ timestamp

### Verify

`timestamp(frame)` must agree with the video's FPS.

Test:

``` text
frame 0 → approximately 0 sec
frame N → N / FPS sec
```

------------------------------------------------------------------------

## `cv_pipeline/detector.py`

### Implement

Wrap Ultralytics detection.

Responsibilities:

-   Load model
-   Run inference
-   Filter classes
-   Filter confidence
-   Return standardized detections

### Verify

Output format must match the input expected by `tracker.py`.

------------------------------------------------------------------------

## `cv_pipeline/tracker.py`

### Implement

Run ByteTrack through Ultralytics tracking.

Responsibilities:

-   Maintain object IDs
-   Associate detections across frames
-   Return tracked objects

### Verify

Output must contain:

``` text
object_id
class_name
bbox
confidence
frame_id
timestamp
```

Object IDs must remain reasonably stable during continuous visibility.

------------------------------------------------------------------------

## `cv_pipeline/trajectory.py`

### Implement

Convert tracked detections into trajectory records.

Calculate:

-   Center position
-   Bounding-box size
-   Frame
-   Timestamp
-   Object ID
-   Class

Optional derived values:

-   Velocity
-   Direction
-   Displacement

### Verify

The output schema must exactly match `docs/event-schema.md`'s trajectory
section.

------------------------------------------------------------------------

## `cv_pipeline/annotations.py`

### Implement

Draw:

-   Bounding boxes
-   Object IDs
-   Class names
-   Confidence
-   Optional event labels

### Verify

Annotations must use the same object IDs as trajectory data.

------------------------------------------------------------------------

## `cv_pipeline/pipeline.py`

### Implement

Orchestrate:

``` text
video_reader
    ↓
detector
    ↓
tracker
    ↓
trajectory
    ↓
annotations
```

### Verify

One input video must produce:

``` text
annotated video
+
trajectory file
```

with matching timestamps.

------------------------------------------------------------------------

## `cv_pipeline/run_pipeline.py`

### Implement

CLI entry point.

Example conceptual command:

``` text
python -m cv_pipeline.run_pipeline --input video.mp4
```

### Verify

A fresh user can run the pipeline using only the README instructions.

------------------------------------------------------------------------

# 24. Phase 2 --- Behaviour Engine File-Level Plan

## `behaviour_engine/config.py`

### Implement

Store behaviour thresholds.

Example:

``` text
DROP_VERTICAL_THRESHOLD
DROP_TIME_WINDOW
DRAG_DURATION
DRAG_SPEED
STACK_OVERLAP_THRESHOLD
```

### Verify

Thresholds used by rules must originate here or from a documented
configuration source.

------------------------------------------------------------------------

## `behaviour_engine/geometry.py`

### Implement

Reusable geometry functions:

-   Box center
-   Area
-   IoU
-   Overlap
-   Relative position
-   Distance

### Verify

All rules use these common calculations instead of implementing slightly
different versions.

------------------------------------------------------------------------

## `behaviour_engine/motion.py`

### Implement

Trajectory calculations:

-   Vertical displacement
-   Horizontal displacement
-   Speed
-   Direction
-   Sudden movement
-   Stationary state

### Verify

Calculations use timestamps/FPS correctly.

------------------------------------------------------------------------

## `behaviour_engine/temporal.py`

### Implement

Temporal utilities:

-   Sliding windows
-   Consecutive-frame conditions
-   Minimum duration
-   Stabilization after movement
-   Event cooldown

### Verify

Rules do not trigger repeatedly for the same continuous incident.

------------------------------------------------------------------------

## `behaviour_engine/base_rule.py`

### Implement

Define common behaviour-rule interface.

Conceptual contract:

``` text
evaluate(trajectory_context) → zero or more behaviour candidates
```

### Verify

Every behaviour rule follows the same interface.

------------------------------------------------------------------------

## `drop_rule.py`

### Implement

Detect:

``` text
rapid downward movement
+
large displacement
+
subsequent stationary state
```

### Verify

Compare detected drops against manually annotated video timestamps.

------------------------------------------------------------------------

## `drag_rule.py`

### Implement

Detect:

``` text
object near floor
+
sustained horizontal movement
+
movement duration above threshold
```

### Verify

Check against video and reject ordinary carrying/movement where
possible.

------------------------------------------------------------------------

## `rough_handling_rule.py`

### Implement

Use abrupt movement / impact-like motion signals.

### Verify

Must not label every fast movement as rough handling.

------------------------------------------------------------------------

## `throw_rule.py`

### Implement

Detect rapid movement consistent with throwing.

### Verify

Test against both positive and normal handling clips.

------------------------------------------------------------------------

## `stacking_rule.py`

### Implement

Analyze relative bounding boxes and stacking configuration.

### Verify

Check whether the relationship is actually observable from the camera
angle.

------------------------------------------------------------------------

## `unstable_stack_rule.py`

### Implement

Detect suspicious stacking configuration or movement where measurable.

### Verify

Avoid claiming physical stability from insufficient visual evidence.

------------------------------------------------------------------------

## `designated_area_rule.py`

### Implement

Check whether an object ends outside configured regions.

### Verify

The region definition must match the specific camera/video setup.

------------------------------------------------------------------------

## `equipment_rule.py`

### Implement

Detect cases where required handling equipment is absent if the
necessary objects are visible.

### Verify

Do not trigger when equipment is outside the camera view.

------------------------------------------------------------------------

## `pallet_rule.py`

### Implement

Detect pallet/product positioning relationships.

### Verify

Validate using footage where pallet boundaries are visible.

------------------------------------------------------------------------

## `sequence_rule.py`

### Implement

Represent multi-step sequences such as:

``` text
pick up
→ move
→ place
```

and detect violations of expected sequence.

### Verify

Sequence logic must use tracked object history, not independent frames.

------------------------------------------------------------------------

## `rule_engine.py`

### Implement

Run all enabled rules over trajectory data.

Responsibilities:

-   Load rules
-   Evaluate rules
-   De-duplicate events
-   Return behaviour candidates

### Verify

All rule outputs use a common internal candidate format.

------------------------------------------------------------------------

## `event_builder.py`

### Implement

Convert behaviour candidates into standardized events.

### Verify

Output must match:

``` text
docs/event-schema.md
risk_engine
backend database model
```

------------------------------------------------------------------------

# 25. Phase 3 --- Risk Engine File-Level Plan

## `risk_engine/config.py`

### Implement

Store:

-   Behaviour severity
-   Factor weights
-   Risk boundaries

### Verify

Values match `docs/risk-scoring.md`.

------------------------------------------------------------------------

## `severity.py`

### Implement

Map behaviours to base severity.

Example:

``` text
drop → high
drag → medium
throw → critical
```

These are example classifications and must be finalized by the team.

### Verify

Every supported behaviour has a defined base severity.

------------------------------------------------------------------------

## `factors.py`

### Implement

Calculate measurable risk factors:

-   Height
-   Impact
-   Duration
-   Frequency
-   Location
-   Behaviour severity

### Verify

Each factor has:

-   Defined input
-   Defined range
-   Defined handling for missing data

------------------------------------------------------------------------

## `scorer.py`

### Implement

Calculate the numeric risk score.

### Verify

Same input must always produce the same score.

Test boundary values.

------------------------------------------------------------------------

## `classifier.py`

### Implement

Map numeric score to:

``` text
Low
Medium
High
Critical
```

### Verify

No gaps or overlaps exist between score ranges.

------------------------------------------------------------------------

## `explanation.py`

### Implement

Generate a deterministic explanation based on actual factors.

Example:

``` text
High risk because the product experienced a large downward displacement
over a short interval and then remained stationary after the event.
```

### Verify

Explanation must correspond to the actual scoring inputs.

------------------------------------------------------------------------

# 26. Phase 4 --- Backend File-Level Plan

## `backend/app/main.py`

### Implement

FastAPI application.

Responsibilities:

-   Initialize application
-   Register routers
-   Configure middleware
-   Configure CORS for frontend development

### Verify

All documented routes are registered.

------------------------------------------------------------------------

## `backend/app/config.py`

### Implement

Read environment configuration:

``` text
DATABASE_URL
CLAUDE_API_KEY
CLAUDE_MODEL
VIDEO_STORAGE_PATH
```

### Verify

Secrets are never committed to Git.

------------------------------------------------------------------------

## `backend/app/db/database.py`

### Implement

SQLite connection/session management.

### Verify

All database access goes through the configured database layer.

------------------------------------------------------------------------

## `backend/app/db/models.py`

### Implement

Database representation of:

-   Videos
-   Events
-   Optional behaviour metadata

### Verify

Fields correspond to the canonical event schema.

------------------------------------------------------------------------

## `backend/app/db/repository.py`

### Implement

Database operations:

-   Insert event
-   Get events
-   Get event by ID
-   Filter by risk
-   Filter by behaviour
-   Aggregate events
-   Query by bay/date if available

### Verify

No frontend-specific logic should exist here.

------------------------------------------------------------------------

## `backend/app/schemas/event.py`

### Implement

Pydantic request/response schemas for events.

### Verify

Must match the frontend TypeScript event types.

------------------------------------------------------------------------

## `backend/app/schemas/video.py`

### Implement

Video metadata schemas.

### Verify

Must match `frontend/src/types/video.ts`.

------------------------------------------------------------------------

## `backend/app/schemas/analytics.py`

### Implement

Schemas for dashboard statistics.

### Verify

Every field returned by analytics endpoints is represented in the
frontend types.

------------------------------------------------------------------------

## `backend/app/schemas/assistant.py`

### Implement

Chat request/response models.

Example:

``` text
question
answer
source_events
```

### Verify

Frontend can render the response without parsing arbitrary Claude
output.

------------------------------------------------------------------------

## `backend/app/services/event_service.py`

### Implement

Business logic for events.

### Verify

API routes call services rather than embedding database logic directly.

------------------------------------------------------------------------

## `backend/app/services/analytics_service.py`

### Implement

Calculate:

-   Event counts
-   Risk counts
-   Behaviour counts
-   Timeline
-   Bay statistics

### Verify

Dashboard totals must equal database query results.

------------------------------------------------------------------------

## `backend/app/services/assistant_service.py`

### Implement

Assistant orchestration:

``` text
question
→ identify query intent
→ retrieve relevant events
→ construct grounded context
→ call Claude
→ validate response
```

### Verify

Assistant answers must be traceable to retrieved event records.

------------------------------------------------------------------------

## `backend/app/integrations/claude_client.py`

### Implement

Claude API wrapper.

Responsibilities:

-   Authentication
-   Request creation
-   Model call
-   Error handling
-   Timeout handling

### Verify

No Claude API key is exposed to React.

------------------------------------------------------------------------

## `backend/app/api/events.py`

### Implement

Event endpoints.

### Verify

Response objects exactly match documented schemas.

------------------------------------------------------------------------

## `backend/app/api/videos.py`

### Implement

Video metadata endpoints and video-reference handling.

### Verify

Frontend event timestamps correctly map to available video references.

------------------------------------------------------------------------

## `backend/app/api/analytics.py`

### Implement

Dashboard analytics endpoints.

### Verify

Values match direct SQLite calculations.

------------------------------------------------------------------------

## `backend/app/api/assistant.py`

### Implement

Chat endpoint.

### Verify

Request reaches `assistant_service.py`, never directly from the router
to Claude.

------------------------------------------------------------------------

## `backend/app/api/health.py`

### Implement

Health endpoint.

Example:

``` text
GET /api/health
```

### Verify

Used by frontend/deployment checks.

------------------------------------------------------------------------

# 27. Phase 5 --- Frontend File-Level Plan

## `frontend/src/main.tsx`

### Implement

React application entry point.

### Verify

App mounts successfully.

------------------------------------------------------------------------

## `frontend/src/App.tsx`

### Implement

Top-level routing/layout.

### Verify

Pages load without directly embedding API calls.

------------------------------------------------------------------------

## `frontend/src/api/client.ts`

### Implement

Central HTTP client.

Responsibilities:

-   Base API URL
-   GET/POST handling
-   Error handling
-   JSON parsing

### Verify

All API modules use this client.

------------------------------------------------------------------------

## `frontend/src/api/events.ts`

### Implement

Functions:

``` text
getEvents()
getEvent(id)
```

with filtering support.

### Verify

Request parameters match FastAPI endpoint parameters.

------------------------------------------------------------------------

## `frontend/src/api/videos.ts`

### Implement

Video metadata retrieval.

### Verify

Video IDs correspond to backend records.

------------------------------------------------------------------------

## `frontend/src/api/analytics.ts`

### Implement

Fetch dashboard metrics.

### Verify

Returned data matches analytics TypeScript types.

------------------------------------------------------------------------

## `frontend/src/api/assistant.ts`

### Implement

Send chat questions.

### Verify

API request matches `backend/app/schemas/assistant.py`.

------------------------------------------------------------------------

## `frontend/src/types/event.ts`

### Implement

TypeScript event interface.

### Verify

Field names/types exactly match backend response.

------------------------------------------------------------------------

## `frontend/src/types/video.ts`

### Implement

Video metadata types.

### Verify

Matches backend video schema.

------------------------------------------------------------------------

## `frontend/src/types/analytics.ts`

### Implement

Dashboard metric types.

### Verify

Matches backend analytics response.

------------------------------------------------------------------------

## `frontend/src/types/assistant.ts`

### Implement

Chat request/response types.

### Verify

Matches backend assistant schema.

------------------------------------------------------------------------

## `frontend/src/components/VideoPlayer.tsx`

### Implement

-   Video playback
-   Seek to timestamp
-   Event marker support
-   Optional overlay display

### Verify

Clicking an event timestamp moves the video to the correct location.

------------------------------------------------------------------------

## `frontend/src/components/EventTimeline.tsx`

### Implement

Chronological event visualization.

### Verify

Event order matches timestamps returned by backend.

------------------------------------------------------------------------

## `frontend/src/components/EventList.tsx`

### Implement

Event table/list.

Show:

-   Timestamp
-   Behaviour
-   Score
-   Risk
-   Description

### Verify

Filters affect displayed events correctly.

------------------------------------------------------------------------

## `frontend/src/components/EventDetails.tsx`

### Implement

Incident detail panel.

### Verify

Every displayed value comes from the selected event.

------------------------------------------------------------------------

## `frontend/src/components/RiskBadge.tsx`

### Implement

Reusable Low/Medium/High/Critical display.

### Verify

Frontend never invents a risk level; it displays the backend value.

------------------------------------------------------------------------

## `frontend/src/components/SummaryCards.tsx`

### Implement

Show:

-   Total events
-   High-risk
-   Critical
-   Other key metrics

### Verify

Numbers equal backend analytics responses.

------------------------------------------------------------------------

## `frontend/src/components/BehaviourChart.tsx`

### Implement

Behaviour frequency visualization.

### Verify

Chart totals equal API data.

------------------------------------------------------------------------

## `frontend/src/components/RiskChart.tsx`

### Implement

Risk distribution visualization.

### Verify

Chart values match backend.

------------------------------------------------------------------------

## `frontend/src/components/Filters.tsx`

### Implement

Risk/behaviour filters.

### Verify

Filter values correspond exactly to backend-supported values.

------------------------------------------------------------------------

## `frontend/src/components/AssistantChat.tsx`

### Implement

Chat UI:

-   Question input
-   Submit
-   Loading state
-   Error state
-   Answer display
-   Optional source events

### Verify

Assistant answers are returned from backend, not directly from Claude.

------------------------------------------------------------------------

## `frontend/src/pages/Dashboard.tsx`

### Implement

Compose:

``` text
SummaryCards
VideoPlayer
EventTimeline
EventList
Filters
Charts
AssistantChat
```

### Verify

All components use real API data.

------------------------------------------------------------------------

## `frontend/src/pages/Incident.tsx`

### Implement

Dedicated incident view.

### Verify

Incident ID loads the correct backend event and video timestamp.

------------------------------------------------------------------------

# 28. Phase 6 --- Assistant Integration File-Level Plan

## `backend/app/services/assistant_service.py`

### Implement

Map common supervisor questions to database queries.

Example:

``` text
"highest risk events"
→ ORDER BY risk_score DESC

"most common behaviour"
→ GROUP BY behaviour

"which bay"
→ GROUP BY bay_id

"why high risk"
→ retrieve event + risk explanation
```

### Verify

Use actual database results as context.

------------------------------------------------------------------------

## `backend/app/integrations/claude_client.py`

### Implement

Grounded Claude request.

The system prompt should instruct Claude to:

-   Use only supplied event information.
-   State when information is unavailable.
-   Avoid claiming confirmed damage without evidence.
-   Explain risk using supplied event data.

### Verify

Test questions whose answers are known.

Also test questions where the database contains no answer.

Expected behaviour:

``` text
No supporting event data found.
```

rather than an invented answer.

------------------------------------------------------------------------

# 29. Phase 7 --- Integration Contracts

## Contract A --- CV → Behaviour Engine

Input:

``` text
trajectory records
```

Must contain:

``` text
frame_id
timestamp
object_id
class_name
x
y
width
height
confidence
```

Verify:

-   Same coordinate system
-   Same frame numbering
-   Same timestamp convention
-   Same object ID semantics

------------------------------------------------------------------------

## Contract B --- Behaviour → Risk Engine

Input:

``` text
behaviour candidate
```

Must contain:

``` text
behaviour
object_id
start_time
end_time
evidence
measured factors
```

Verify:

-   Every behaviour has a base severity.
-   Missing factors have defined defaults.
-   Event IDs are generated consistently.

------------------------------------------------------------------------

## Contract C --- Risk Engine → Backend

Input:

``` text
risk-scored event
```

Must contain:

``` text
event_id
behaviour
risk_score
risk_level
reason
timestamp
evidence
```

Verify:

-   Score is numeric.
-   Level is one of four valid levels.
-   Explanation matches the score.
-   Evidence reference exists.

------------------------------------------------------------------------

## Contract D --- Backend → Frontend

Verify:

-   JSON field names match TypeScript types.
-   Timestamps use one consistent convention.
-   Risk values are not reformatted incorrectly.
-   Video references are resolvable.
-   Filters use backend-supported values.

------------------------------------------------------------------------

## Contract E --- Backend → Claude

Verify:

``` text
Question
+
Retrieved events
→
Claude
```

not:

``` text
Question
→
Claude
```

The assistant must be grounded in retrieved events.

------------------------------------------------------------------------

# 30. Phase 8 --- Testing Structure

## `tests/cv/`

Test:

-   Video metadata
-   Detection output format
-   Tracking IDs
-   Trajectory generation

------------------------------------------------------------------------

## `tests/behaviour/`

Test each behaviour independently.

For each rule:

``` text
positive case
negative case
boundary case
```

Example:

``` text
Drop:
- clear drop → detect
- normal placement → don't detect
- borderline displacement → validate threshold
```

------------------------------------------------------------------------

## `tests/risk/`

Test:

-   Base severity
-   Factor calculations
-   Score
-   Boundaries
-   Risk level
-   Explanation

------------------------------------------------------------------------

## `tests/backend/`

Test:

-   Database insertion
-   Event retrieval
-   Filtering
-   Analytics
-   API schemas
-   Assistant grounding

------------------------------------------------------------------------

## `tests/frontend/`

Test:

-   Event rendering
-   Filters
-   Video seeking
-   Dashboard metrics
-   Chat interaction

------------------------------------------------------------------------

# 31. Cross-File Verification Matrix

  -------------------------------------------------------------------------
  Source                                Must agree with
  ------------------------------------- -----------------------------------
  `cv_pipeline/trajectory.py`           `docs/event-schema.md`, behaviour
                                        engine

  `behaviour_engine/*.py`               `docs/behaviour-rules.md`

  `behaviour_engine/event_builder.py`   risk engine + backend event schema

  `risk_engine/*.py`                    `docs/risk-scoring.md`

  `backend/app/schemas/event.py`        database model + frontend event
                                        type

  `backend/app/api/events.py`           frontend `api/events.ts`

  `backend/app/api/analytics.py`        frontend analytics API/types

  `backend/app/api/assistant.py`        frontend assistant API/types

  `claude_client.py`                    `assistant_service.py`

  `EventDetails.tsx`                    backend event response

  `VideoPlayer.tsx`                     video metadata + event timestamps

  `Filters.tsx`                         backend query parameters

  `RiskBadge.tsx`                       backend risk levels

  `BehaviourChart.tsx`                  backend analytics response

  `RiskChart.tsx`                       backend analytics response
  -------------------------------------------------------------------------

------------------------------------------------------------------------

# 32. Definition of Done

The project is considered technically complete when:

## CV

-   Video can be loaded.
-   Objects can be detected.
-   Objects can be tracked.
-   Trajectories are generated.
-   Annotated output can be produced.

## Behaviour

-   Selected behaviours are implemented.
-   Rules operate over time.
-   Positive and negative examples are tested.
-   Duplicate events are controlled.

## Risk

-   Every event receives a score.
-   Every event receives Low/Medium/High/Critical.
-   Every score has an explanation.
-   Risk logic is documented.

## Backend

-   SQLite stores events.
-   FastAPI exposes events.
-   Analytics endpoints work.
-   API schemas are stable.

## Frontend

-   React dashboard loads.
-   Video can be viewed.
-   Events can be filtered.
-   Event selection works.
-   Risk information is visible.
-   Analytics are visible.

## Assistant

-   Supervisor can ask questions.
-   Backend queries event data first.
-   Claude receives retrieved event context.
-   Assistant does not invent unavailable facts.

## Validation

-   Ground-truth examples exist.
-   False positives are recorded.
-   At least basic precision/recall or equivalent event-validation
    results are available.
-   User feedback is documented.

## Demo

-   At least 3--5 representative scenarios can be demonstrated in the
    short demo.
-   Prototype demonstrates the required end-to-end flow.
-   Presentation contains architecture, screenshots, demo evidence,
    impact and validation.

------------------------------------------------------------------------

# 33. Recommended Development Order

Do NOT start all files simultaneously.

Use this dependency order:

``` text
STEP 1
Contracts
├── trajectory schema
├── behaviour schema
├── event schema
├── risk schema
└── API schema

STEP 2
CV Pipeline
└── Video → Detection → Tracking → Trajectory

STEP 3
Behaviour Engine
└── Trajectory → Behaviour Events

STEP 4
Risk Engine
└── Behaviour → Risk

STEP 5
Database
└── Events → SQLite

STEP 6
FastAPI
└── SQLite → REST API

STEP 7
React
└── REST API → Dashboard

STEP 8
Claude
└── API → Database → Claude → Dashboard

STEP 9
End-to-End Testing
└── Video → Dashboard → Assistant

STEP 10
Validation + Demo
└── Metrics → Screenshots → Demo → Presentation
```

------------------------------------------------------------------------

# 34. Team Ownership

## Member 1 --- Computer Vision / Data Engineer

Owns:

``` text
cv_pipeline/
models/
scripts/run_detection.py
scripts/generate_trajectories.py
```

Primary responsibility:

**Video → Detection → Tracking → Trajectories**

------------------------------------------------------------------------

## Member 2 --- Behaviour + Risk Engineer

Owns:

``` text
behaviour_engine/
risk_engine/
docs/behaviour-rules.md
docs/risk-scoring.md
tests/behaviour/
tests/risk/
```

Primary responsibility:

**Trajectories → Behaviour → Risk**

------------------------------------------------------------------------

## Member 3 --- Frontend Developer

Owns:

``` text
frontend/
tests/frontend/
```

Primary responsibility:

**REST API → React Dashboard**

Stack:

``` text
React
TypeScript
Tailwind CSS
```

------------------------------------------------------------------------

## Member 4 --- Backend + AI Developer

Owns:

``` text
backend/
tests/backend/
docs/api-contract.md
```

Primary responsibility:

**Events → SQLite → FastAPI → Claude**

Stack:

``` text
Python
FastAPI
SQLite
SQL
Claude API
```

------------------------------------------------------------------------

## Member 5 --- Product / QA / Validation

Owns:

``` text
docs/validation-report.md
docs/demo-script.md
```

Responsibilities:

-   Ground-truth annotations
-   Video review
-   Behaviour validation
-   False-positive tracking
-   User testing
-   Responsible-AI documentation
-   Presentation
-   Demo coordination

------------------------------------------------------------------------

# 35. Critical Integration Rule

The single most important project-management rule is:

> **Freeze the data contracts before parallel development.**

Specifically freeze:

1.  Trajectory schema
2.  Behaviour event schema
3.  Risk event schema
4.  REST API response schema

Once these are stable:

``` text
Member 1 ──→ Member 2
Member 2 ──→ Member 4
Member 4 ──→ Member 3
Member 4 ──→ Claude
Member 5 ──→ Everyone
```

can proceed mostly in parallel.

If these schemas are changed casually halfway through the project, the
CV, scoring, backend and frontend will all need synchronized changes.

------------------------------------------------------------------------

# 36. Final Product Definition

The finished prototype should demonstrate:

``` text
                    AI VIDEO INTELLIGENCE
                             │
                             ▼
                      Warehouse Video
                             │
                             ▼
                   Detect + Track Objects
                             │
                             ▼
                  Understand Behaviour
                             │
                             ▼
                       Risk Scoring
                             │
                             ▼
                      Incident Events
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
           Dashboard                AI Assistant
                │                         │
                └────────────┬────────────┘
                             ▼
                    Supervisor Decision
                             │
                             ▼
                       Intervention
                             │
                             ▼
                     Damage Prevention
```

The product should ultimately demonstrate the shift from:

**CCTV Surveillance → Operational Intelligence**

and:

**Damage Detection → Damage Prevention**

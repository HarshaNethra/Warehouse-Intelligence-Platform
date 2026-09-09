# YOLO Warehouse — Forensic Visualization & Statistical Deep-Dive

## SECTION A — DATASET OVERVIEW

### Data Quality Summary

- **Telemetry Frames**: 1111

- **Inference Frames**: 150

- **Total Detections**: 150

- **Unique Classes**: 1

- **Unique Timestamps**: 129


| Variable | Count | Missing | Unique | Mean | Median | Std | Min | Max |

|---|---|---|---|---|---|---|---|---|

| confidence | 150 | 0 | 1 | 0.91 | 0.91 | 0.00 | 0.91 | 0.91 |

| bbox_area | 150 | 0 | 150 | 32466.43 | 17592.52 | 46126.07 | -182.78 | 267389.10 |

| center_x | 150 | 0 | 147 | 430.20 | 411.85 | 90.06 | 211.45 | 667.55 |

| center_y | 150 | 0 | 146 | 246.58 | 207.82 | 90.27 | 121.85 | 473.95 |

| width | 150 | 0 | 148 | -479.49 | -539.65 | 275.49 | -1035.40 | 305.10 |

| height | 150 | 0 | 142 | -51.51 | -30.85 | 93.38 | -416.30 | 277.80 |

![GRAPH A1](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA1_coverage.png)


## SECTION B — TEMPORAL BEHAVIOR
![GRAPH A3](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA3_frame_interval.png)

![GRAPH A4](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA4_interval_time.png)

![GRAPH A5](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA5_fps.png)


## SECTION E — OBJECT SIZE & BOUNDING BOX ANOMALIES

![GRAPH A6](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA6_bbox_area.png)

![GRAPH A7](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA7_bbox_frame.png)

**Invalid BBox Areas Identified**: 3 detections.

| Frame | Class | x1 | y1 | x2 | y2 | Width | Height | Area |

|---|---|---|---|---|---|---|---|---|

| 2 | person | 199.1 | 390.0 | 223.8 | 382.6 | 24.7 | -7.4 | -182.8 |

| 3 | person | 207.2 | 389.4 | 221.9 | 377.4 | 14.7 | -12.0 | -176.4 |

| 4 | person | 223.2 | 393.0 | 225.2 | 377.2 | 2.0 | -15.8 | -31.6 |


## SECTION C — CONFIDENCE BEHAVIOR

**Unique Confidence Values**: 1 (`[0.91]`)

**Variance**: 4.963470460702675e-32

![GRAPH A10](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA10_conf_freq.png)


## SECTION D — SPATIAL BEHAVIOR

![GRAPH A13](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA13_clustering.png)


## SECTION F — MOVEMENT

![GRAPH A20](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA20_displacement.png)

![GRAPH A22](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/forensic_plots\gA22_spatial_path.png)


## SECTION G — DATA INTEGRITY & SCORECARDS

### Data-Quality Scorecard

| Check | Status | Evidence |
|---|---|---|

| Missing values | WARNING | 3 missing values |

| Timestamp consistency | WARNING | Std dev of dt = 0.1329 |

| 30 FPS consistency | WARNING | Mean dt = 0.0537s |

| Negative bbox areas | CRITICAL | 3 negative areas |

| Constant confidence | PASS | Var = 0.0000 |

| Inference coverage | WARNING | 150 frames out of 1111 telemetry |

| Class diversity | WARNING | 1 class(es) detected |


### Model Observability Scorecard

| Dimension | Status | Evidence |
|---|---|---|

| Temporal observability | GOOD | Timestamps are recorded per frame. |

| Confidence observability | POOR | Confidence is static; dynamic pipeline logging is broken. |

| Spatial observability | GOOD | Coordinates recorded. |

| Bounding-box observability | POOR | Evidence of negative geometries (x2 < x1 or y2 < y1). |

| Class observability | POOR | Only single class evaluated. |

| Ground-truth availability | CRITICAL | Missing, rendering accuracy metrics invalid. |


## SECTION M — FINAL INTERPRETATION

### DATA COVERAGE

The 150 inference frames are heavily subsampled compared to the 1111 telemetry frames. The timeline indicates sparse inference snapshots rather than continuous 30 FPS inference logging.

### CONFIDENCE

Confidence is 100% statically locked at 0.91. This is a critical pipeline bug (likely a hardcoded value injected into the JSON during serialization), meaning dynamic model confidence is completely obscured.

### BOUNDING BOX

There are 3 instances of negative bounding box areas. This proves that either x2 < x1 or y2 < y1 in the payload, which represents a critical geometric data anomaly that must be fixed in the preprocessing/postprocessing pipeline.

### SPATIAL

K-Means successfully identifies two heavily separated spatial clusters, but interpretation without context or tracking IDs limits conclusive claims about warehouse zones.

### TEMPORAL

While a 30 FPS baseline is claimed, the actual frame intervals exhibit a mean of 0.0537s with significant standard deviation, representing irregular sampling or processing stalls.

### DATA QUALITY

The raw payload cannot be entirely trusted. Confidence is static, geometries contain negative areas, and temporal extraction is subsampled. These engineering pipeline flaws must be fixed before deploying any new YOLO weights.

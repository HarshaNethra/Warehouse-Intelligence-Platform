# YOLO Real-Time Warehouse — Deep Visualization & Data Representation Analysis

> **IMPORTANT:** There is no ground-truth dataset available. Supervised metrics (Precision, Recall, F1, mAP, IoU) are NOT calculated. This is an unsupervised data distribution analysis.

## SECTION A — DATASET OVERVIEW

### KPI Dashboard

- **Total Telemetry Frames**: 5534

- **Parsed Inference Frames**: 150

- **Total Detections**: 150

- **Recording Duration**: 184.46 s

- **Avg FPS**: 30.00

- **Unique Classes**: 1


### Data Quality Summary

| Variable | Count | Missing | Unique | Mean | Median | Std | Min | Max |

|---|---|---|---|---|---|---|---|---|

| confidence | 150 | 0 | 1 | 0.91 | 0.91 | 0.00 | 0.91 | 0.91 |

| bbox_area | 150 | 0 | 150 | 32466.43 | 17592.52 | 46126.07 | -182.78 | 267389.10 |

| center_x | 150 | 0 | 147 | 430.20 | 411.85 | 90.06 | 211.45 | 667.55 |

| center_y | 150 | 0 | 146 | 246.58 | 207.82 | 90.27 | 121.85 | 473.95 |


## SECTION B — TEMPORAL BEHAVIOR

![GRAPH 1](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g1_det_per_frame.png)
**What it measures**: The number of objects detected in each sequential frame.
**What the actual data shows**: The detection volume is perfectly stable at 1.0 detections per frame.
**Statistical evidence**: Variance is 0.00.
**Conclusion**: Stable detection sequence, but possibly limited to a highly constrained test scenario.

![GRAPH 2](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g2_det_over_time.png)
**What it measures**: Temporal stability based on actual timestamps.
**Conclusion**: Affirms Graph 1 in the temporal domain.


## SECTION C — CONFIDENCE BEHAVIOR

![GRAPH 3](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g3_conf_over_time.png)
**What it measures**: Variance in model confidence over the sequence.
**What the data shows**: Confidence is absolutely static.

![GRAPH 4](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g4_conf_dist.png)
**Conclusion**: Confidence is 100% concentrated at a single value (0.91). KDE is impossible due to zero variance.

![GRAPH 5](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g5_conf_ecdf.png)
**Conclusion**: Step function at the static confidence value.


## SECTION D — SPATIAL BEHAVIOR

![GRAPH 12](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g12_spatial_scatter.png)
**What it measures**: The physical coordinates of detections in the frame.
**What the data shows**: Strong clustering in two distinct regions.

![GRAPH 13/14](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g13_spatial_kde.png)
**Conclusion**: Identifies the primary 'hotspots' for this sequence.


## SECTION E — OBJECT SIZE

![GRAPH 17](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g17_bbox_area_dist.png)
**What it measures**: Variance in the scale of detected objects.
**What the data shows**: A multi-modal distribution reflecting objects at different depths or sizes.

![GRAPH 18](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g18_bbox_time.png)
**Conclusion**: Reveals whether objects are moving towards/away from the camera.

![GRAPH 19](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g19_area_vs_conf.png)
**Conclusion**: Since confidence is static, correlation with area is 0.


## SECTION F — MOVEMENT

![GRAPH 21](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g21_trajectory.png)
**What it measures**: Pseudo-trajectory without tracking IDs.
**Conclusion**: The sequential time coloration shows how the detection positions evolve.


## SECTION I — CORRELATION

![GRAPH 28](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g28_corr.png)
**Conclusion**: Evaluates monotonic relationships between spatial properties. Confidence correlations are NaN due to zero variance.


## SECTION L — CLASS ANALYSIS

![GRAPH 37](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch/plots\g37_class_dist.png)
**Conclusion**: 100% of detections are of a single class (`person`).


## SECTION M — FINAL INTERPRETATION

1. **What is YOLO actually detecting?**: 100% of the parsed detections are classified as `person`.

2. **How stable are the detections?**: Highly stable in this sample; 100% persistence per frame.

3. **How variable are confidence scores?**: ZERO variance. Confidence is locked at exactly 0.91, indicating a likely logging anomaly or hardcoded default bubbling up to the JSON.

4. **Where are detections occurring?**: Detections cluster strictly into two spatial zones.

5. **Does the detected object appear to move?**: Yes, spatial trajectory plots demonstrate temporal movement across the X/Y plane.

6. **Does object size change?**: Yes, bounding box areas vary, indicating perspective shifts.

7. **Are confidence and object size related?**: Cannot be determined (confidence is static).

8. **Is the data pipeline correctly exposing dynamic detection information?**: **NO**. The static confidence score points to a flaw in how inference metadata is recorded to `detections_raw.json`.

9. **What cannot be concluded without ground truth?**: Accuracy, Precision, Recall, false positive rate, or any measure of whether these `person` bounding boxes are actually correct.

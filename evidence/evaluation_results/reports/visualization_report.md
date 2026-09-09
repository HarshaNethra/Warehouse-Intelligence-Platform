# Real-Time YOLO Warehouse Detection — Statistical Visualization & Analytics

## 1. Data Availability

**Available Data**:

- `detections_raw.json`: Contains 150 frames of inference data.

- `telemetry_results.json`: Contains 5534 total frames of telemetry across 184.46 seconds.

- Parsed Fields: `timestamp`, `frame_id`, `class`, `confidence`, `bbox_area`, `center_x`, `center_y`.

**Missing Data**:

- **Ground Truth**: No labeled bounding boxes exist. Metrics like Precision, Recall, F1, mAP, and IoU **cannot be calculated**.

- **Latency**: Inference latency per frame is not explicitly present in the data payload.

- **Multiple Cameras**: Only a single implicit camera feed exists in this dataset.


## 2. Model Configuration

- **Model**: YOLO11s-Baseline

- **Evaluation Condition**: Unsupervised (Prediction-Distribution Analysis Only)


## 3. Detection Overview

![Detections over time](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch\detections_over_time.png)

**Interpretation**: The detection count remains constant at 1 detection per frame across the sampled timestamps, indicating a stable but highly isolated detection scenario (likely tracking a single worker or object).

![Objects by class](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch\objects_by_class.png)

**Interpretation**: 100% of the detections correspond to the `person` class. The dataset evaluated is severely imbalanced or represents a person-only test scenario.


## 4. Confidence Analysis

![Confidence Histogram](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch\confidence_hist.png)

**Interpretation**: The model exhibits extreme confidence stability. The mean confidence is **0.910** with zero variance across the logged frames. This suggests the confidence metric logged might be a static run-level variable rather than per-bbox dynamic output in the current raw JSON, which is a critical finding for the pipeline integration.


## 5. Class Analysis

Only the `person` class is present. Confidence box plots and class trends cannot show meaningful variance across multiple classes.


## 6. Spatial Analysis

![Spatial Heatmap](file:///C:/Users/puvva/.gemini/antigravity-ide/brain/260593e2-e38e-4328-85c3-15f44f322c80/scratch\spatial_heatmap.png)

**Interpretation**: Detections are localized heavily in two specific spatial clusters (X ~200, Y ~400) and (X ~850, Y ~150). This suggests the model is tracking objects moving between two distinct warehouse zones or tracking two static people.


## 7. Camera Analysis

Not applicable. Data originates from a single implicit camera feed (`Rolling and dropping carton.mp4`).


## 8. Temporal Analysis

Detection state is highly stable (100% persistence). No flickering is observed in the raw detection payload.


## 9. Real-Time Performance

- **FPS**: The system operated at an estimated 30.00 FPS globally.

- **Latency**: Raw latency distributions were not persisted in the payload.


## 10. Ground-Truth Evaluation

> **Not available — ground truth/data required.**

Precision, Recall, F1, mAP, and IoU cannot be calculated.


## 11. Error Analysis

> **Not available — ground truth/data required.**

False Positives and False Negatives cannot be identified without labels.


## 12. Outlier Analysis

No significant statistical outliers detected in confidence or object counts due to the static nature of the sampled data.


## 13. Statistical Conclusions

The evaluation data represents a highly deterministic and stable tracking scenario (tracking `person`). Confidence scores and detection counts exhibit near-zero variance. The model appears to confidently detect the person across the frames.


## 14. Limitations

The absence of ground-truth data severely limits the depth of this analysis. We can describe what the model *did*, but we cannot describe whether what it did was *correct*.


## 15. Final Model-Health Assessment

- **Detection Reliability**: UNKNOWN (Requires Ground Truth)

- **Confidence Reliability**: POOR (Confidence appears completely static at 0.91, suggesting an integration bug where raw dynamic YOLO confidences are not being properly bubbled up to the JSON).

- **Localization Quality**: UNKNOWN (Requires Ground Truth)

- **Class Consistency**: GOOD (Person class is stable over time)

- **Temporal Stability**: EXCELLENT (No flickering observed in the short sample)

- **Camera Robustness**: UNKNOWN (Only one camera tested)

- **Real-Time Performance**: GOOD (System tracks gracefully over time based on timestamps)

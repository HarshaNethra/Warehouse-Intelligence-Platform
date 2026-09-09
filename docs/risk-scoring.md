# Risk Scoring & Explainability Specification

**Godrej Warehouse Intelligence Platform**  
*Component Owner: Member 2 (Behaviour + Risk Engineer)*

This document defines the mathematical risk scoring formula, factor normalizations, category boundary definitions, and explainability policy implemented in `risk_engine/`.

---

## 1. Core Principles

1. **Deterministic & Auditable**: Given identical evidence coordinates, the scoring engine produces the exact same numeric score every time.
2. **Transparent Multi-Factor Formulation**: Risk is not a single opaque scalar. It is broken down into base physical severity plus quantifiable environmental factors.
3. **Strict Clamping**: All risk scores are strictly bounded in the interval $[0, 100]$.
4. **Distinction of Integrity**: The system reports **Potential Risk**, not confirmed physical damage:
   $$\text{Observed Behaviour} \longrightarrow \text{Potential Handling Risk} \longrightarrow \text{Physical Damage (Requires Inspection)}$$

---

## 2. Mathematical Scoring Formula

$$\text{Risk Score} = \operatorname{Clamp}_{[0, 100]}\left(\operatorname{Round}\left(\text{Base Severity} + \sum_{i} (\text{Factor}_i \times W_i)\right)\right)$$

Where:
- $\text{Base Severity} \in [0, 100]$: The baseline hazard rating of the detected mishandling behavior.
- $\text{Factor}_i \in [0.0, 30.0]$: Quantifiable kinematic and environmental risk multipliers.
- $W_i \in [0.0, 1.0]$: Importance weights assigned to each factor.

---

## 3. Base Severities

| Behaviour Type | Base Severity | Justification |
| :--- | :---: | :--- |
| **`stepping_on_cartons`** | **65** | Immediate structural crush risk and worker falling hazard. |
| **`product_thrown`** | **60** | Uncontrolled kinetic energy and high impact likelihood. |
| **`product_dropped`** | **50** | Gravitational acceleration and shock damage to internals. |
| **`rough_handling`** | **45** | Cumulative corner and seal degradation from tumbling. |
| **`unstable_stack`** | **40** | High probability of subsequent column collapse. |
| **`designated_area_violation`** | **40** | Dock edge drop-off and wet floor slip hazards. |
| **`product_dragged`** | **35** | Friction abrasions, torn carton bottoms, moisture exposure. |
| **`improper_stacking`** | **30** | Uneven load distribution and lower carton fatigue. |
| **`equipment_violation`** | **30** | Ergonomic risk and dropped heavy product risk. |

---

## 4. Measurable Risk Factors & Normalization

All factors evaluate to a normalized value between $0.0$ and $30.0$:

### 4.1 Height Factor ($W_{\text{height}} = 0.30$)
Evaluates drop or elevation distance:
$$\text{Factor}_{\text{height}} = \operatorname{Clamp}_{[0, 30]}\left(\frac{\Delta y_{\text{drop}} - 60\text{px}}{240\text{px}} \times 30.0\right)$$
- $\le 60\text{px}$: $0.0$
- $300\text{px}$: $30.0$ (maximum penalty)

### 4.2 Impact Factor ($W_{\text{impact}} = 0.35$)
Evaluates peak deceleration upon landing:
$$\text{Factor}_{\text{impact}} = \operatorname{Clamp}_{[0, 30]}\left(\frac{a_{\text{decel}} - 300\text{px/s}^2}{900\text{px/s}^2} \times 30.0\right)$$

### 4.3 Duration Factor ($W_{\text{duration}} = 0.25$)
Evaluates sustained mishandling (e.g. prolonged dragging across dirty floor):
$$\text{Factor}_{\text{duration}} = \operatorname{Clamp}_{[0, 30]}\left(\frac{t_{\text{duration}} - 1.0\text{s}}{5.0\text{s}} \times 30.0\right)$$

### 4.4 Frequency Factor ($W_{\text{frequency}} = 0.20$)
Evaluates repetition of identical violations within the same CCTV session:
$$\text{Factor}_{\text{frequency}} = \min(30.0, (N_{\text{occurrences}} - 1) \times 7.5)$$

### 4.5 Location Hazard Factor ($W_{\text{location}} = 0.25$)
- Dock edge ledge: $25.0$
- Wet / slip floor: $20.0$
- Standard interior floor: $0.0$

---

## 5. Category Boundaries

| Risk Level | Score Range | Operational Meaning & Protocol |
| :---: | :---: | :--- |
| **Low** | **0 – 29** | Minor deviation; log for shift trend analytics. No physical intervention needed. |
| **Medium** | **30 – 59** | Substandard handling practice; supervisor refresher briefing recommended. |
| **High** | **60 – 84** | Significant potential damage; immediate visual package seal inspection required. |
| **Critical** | **85 – 100** | Severe hazard or structural impact; halt operation, quarantine carton for QA check. |

Boundary conditions are strictly non-overlapping:
- Score 29 = `Low`
- Score 30 = `Medium`
- Score 59 = `Medium`
- Score 60 = `High`
- Score 84 = `High`
- Score 85 = `Critical`

---

## 6. Worked Example

### Scenario: Carton dropped from dock loading ramp onto wet floor
- Behaviour: `product_dropped` (Base = 50)
- Measured descent: $\Delta y = 220\text{px} \implies \text{Factor}_{\text{height}} = \frac{220 - 60}{240} \times 30 = 20.0$
- Measured deceleration: $a_{\text{decel}} = 850\text{px/s}^2 \implies \text{Factor}_{\text{impact}} = \frac{850 - 300}{900} \times 30 = 18.3$
- Location: Dock edge $\implies \text{Factor}_{\text{location}} = 25.0$
- Frequency: 2nd occurrence in shift $\implies \text{Factor}_{\text{frequency}} = 7.5$

$$\text{Factor Sum} = (20.0 \times 0.30) + (18.3 \times 0.35) + (25.0 \times 0.25) + (7.5 \times 0.20)$$
$$\text{Factor Sum} = 6.00 + 6.41 + 6.25 + 1.50 = 20.16$$
$$\text{Risk Score} = \operatorname{Clamp}(50 + 20) = 70 \implies \mathbf{High\ Risk}$$

**Generated Explanation**:  
*"HIGH RISK (70/100): Observed product dropped, combined with high drop elevation (220px descent), significant deceleration impact (850px/s²), and proximity to dock edge ledge. Kinematic trajectory indicates potential handling risk to product integrity."*

**Recommended Supervisor Action**:  
*"Physically inspect package seals and internal cushioning at evidence timestamp. Reinforce safe manual handling height limits with the shift team."*

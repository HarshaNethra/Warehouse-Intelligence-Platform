"""
Explainability & Action Engine for Risk Incidents.

Generates:
1. Concise rationale based on actual factor measurements.
2. Comprehensive supervisor explanation maintaining the critical boundary:
   Observed behaviour -> Potential risk -> Confirmed damage.
3. Actionable, non-punitive corrective supervisor intervention.
"""

from typing import Any, Dict, Tuple


def generate_explanation(behaviour_type: str,
                         risk_level: str,
                         risk_score: int,
                         factors: Dict[str, float],
                         evidence: Dict[str, Any]) -> Tuple[str, str]:
    """
    Returns (reason: str, recommended_action: str).
    """
    behaviour_clean = behaviour_type.replace("_", " ").title()

    # Determine primary contributing factors
    active_reasons = []
    if factors.get("impact_factor", 0.0) >= 10.0:
        max_decel = evidence.get("max_deceleration_px_s2") or evidence.get("max_acceleration_px_s2")
        if max_decel and float(max_decel) > 0:
            active_reasons.append(f"significant deceleration impact ({float(max_decel):.0f}px/s²)")
        elif "stepping" in behaviour_type:
            active_reasons.append("bodyweight crush load on package")
        else:
            active_reasons.append("impact deceleration")

    if factors.get("height_factor", 0.0) >= 10.0:
        drop_h = evidence.get("drop_height_px")
        if drop_h and float(drop_h) > 0:
            active_reasons.append(f"high drop elevation ({float(drop_h):.0f}px descent)")
        elif "elevation_y" in evidence:
            elev = max(0.0, 620.0 - float(evidence["elevation_y"]))
            active_reasons.append(f"worker elevation on stack ({elev:.0f}px above floor)")
        else:
            active_reasons.append("elevated handling position")

    if factors.get("duration_factor", 0.0) >= 10.0:
        active_reasons.append(f"prolonged mishandling duration ({evidence.get('duration_seconds', 0):.1f}s)")
    if factors.get("location_factor", 0.0) >= 10.0:
        hazard = str(evidence.get("hazard_type", "hazard area")).replace("_", " ")
        active_reasons.append(f"proximity to {hazard}")
    if factors.get("frequency_factor", 0.0) >= 10.0:
        active_reasons.append("repeated handling violations in this session")

    if active_reasons:
        reasons_text = ", combined with " + ", ".join(active_reasons)
    else:
        reasons_text = ""

    reason = (
        f"{risk_level.upper()} RISK ({risk_score}/100): Observed {behaviour_clean.lower()}{reasons_text}. "
        f"Kinematic trajectory indicates potential handling risk to product integrity."
    )

    # Actionable corrective guidance for supervisors
    actions = {
        "product_dropped": (
            "Physically inspect package seals and internal cushioning at evidence timestamp. "
            "Reinforce safe manual handling height limits with the shift team."
        ),
        "product_thrown": (
            "Halt unassisted tossing of items. Mandate two-person team lifts or conveyor transfer "
            "for cartons and mattresses."
        ),
        "product_dragged": (
            "Check carton bases for friction abrasion or moisture. Instruct operators to use "
            "hand trolleys or pallet jacks rather than dragging on the floor."
        ),
        "rough_handling": (
            "Examine package structural corners for crush damage. Conduct refresher briefing on "
            "controlled carton placement."
        ),
        "stepping_on_cartons": (
            "Immediate safety intervention: prohibit walking or standing on lower product tiers. "
            "Deploy warehouse step ladders or safety platforms."
        ),
        "unstable_stack": (
            "Re-stack column immediately to eliminate overhang. Verify bottom carton load-bearing "
            "specifications."
        ),
        "improper_stacking": (
            "Restructure pallet stack placing heaviest/densest items at the base and lighter "
            "cartons on top."
        ),
        "designated_area_violation": (
            "Clear items away from dock drop-off ledge or wet slip zones. Ensure floor hazards are "
            "marked with cones."
        ),
        "equipment_violation": (
            "Provide pallet jack or hand trolley for bulky furniture and KD packets. Prohibit "
            "manual dragging."
        ),
    }

    recommended_action = actions.get(
        behaviour_type,
        "Review CCTV clip at evidence frame with shift supervisor and verify standard operating procedure."
    )

    return (reason, recommended_action)

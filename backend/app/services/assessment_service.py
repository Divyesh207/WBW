"""Orchestrates the engines and persistence for one assessment."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assessment import Assessment
from app.schemas.product import ProductSpec
from app.services.assessment_engine import METHODOLOGY_VERSION, assess, sig
from app.services.comparison_engine import optimize
from app.services.demo_data import DEMO_SCENARIOS
from app.services.recommendation_engine import default_selection, recommend


def run_pipeline(spec: ProductSpec, selected_ids: list[str] | None = None) -> dict:
    """Assess -> recommend -> build the optimised scenario for the given selection."""
    result = assess(spec)
    recommendations = recommend(spec, result)
    if selected_ids is None:
        selected_ids = default_selection(recommendations)
    optimised = optimize(spec, recommendations, selected_ids)
    return {"result": result, "recommendations": recommendations, **optimised}


def create_assessment(
    db: Session, spec: ProductSpec, *, is_demo: bool = False, created_at: datetime | None = None
) -> Assessment:
    computed = run_pipeline(spec)
    row = Assessment(name=spec.name, category=spec.category, is_demo=is_demo, spec=spec.model_dump(), **computed)
    if created_at:
        row.created_at = created_at
    db.add(row)
    db.commit()
    return row


def reoptimize(db: Session, row: Assessment, selected_ids: list[str]) -> Assessment:
    spec = ProductSpec.model_validate(row.spec)
    optimised = optimize(spec, row.recommendations, selected_ids)
    row.selected_ids = optimised["selected_ids"]
    row.optimized_spec = optimised["optimized_spec"]
    row.optimized_result = optimised["optimized_result"]
    row.comparison = optimised["comparison"]
    db.commit()
    return row


def refresh_outdated(db: Session) -> int:
    """Recalculate assessments saved under an older methodology version.

    Nothing is deleted: the saved specification and the selected
    recommendations are kept, and only the calculated outputs are replaced.
    """
    updated = 0
    for row in db.scalars(select(Assessment)).all():
        if row.result.get("methodology_version") == METHODOLOGY_VERSION:
            continue
        spec = ProductSpec.model_validate(row.spec)
        computed = run_pipeline(spec, row.selected_ids)
        row.result = computed["result"]
        row.recommendations = computed["recommendations"]
        row.selected_ids = computed["selected_ids"]
        row.optimized_spec = computed["optimized_spec"]
        row.optimized_result = computed["optimized_result"]
        row.comparison = computed["comparison"]
        updated += 1
    if updated:
        db.commit()
    return updated


def seed_demo(db: Session, *, force: bool = False) -> int:
    """Insert the demo scenarios when the database is empty (or when forced)."""
    if force:
        for row in db.scalars(select(Assessment)).all():
            db.delete(row)
        db.commit()
    elif db.scalars(select(Assessment.id).limit(1)).first() is not None:
        return 0
    now = datetime.now(timezone.utc)
    for scenario in DEMO_SCENARIOS:
        create_assessment(
            db,
            ProductSpec.model_validate(scenario["spec"]),
            is_demo=True,
            created_at=now - timedelta(days=scenario["days_ago"], hours=3),
        )
    return len(DEMO_SCENARIOS)


def dashboard(db: Session) -> dict:
    rows = db.scalars(select(Assessment).order_by(Assessment.created_at)).all()

    stage_totals: dict[str, dict] = {}
    material_totals: dict[str, float] = {}
    carbon = avoided = material_saved = water_saved = energy_saved = waste_saved = waste_total = 0.0
    per_unit_sum = 0.0
    for row in rows:
        qty = row.spec["production_quantity"]
        per_unit_sum += row.result["per_unit"]["carbon_kg"]
        carbon += row.result["batch"]["carbon_kg"]
        waste_total += row.result["batch"]["waste_kg"]
        s = row.comparison["summary"]
        avoided += s["carbon_saved_kg"]
        material_saved += s["material_saved_kg"]
        water_saved += s["water_saved_l"]
        energy_saved += s["energy_saved_kwh"]
        waste_saved += s["waste_saved_kg"]
        for stage in row.result["stages"]:
            entry = stage_totals.setdefault(
                stage["key"], {"key": stage["key"], "label": stage["label"], "carbon_kg": 0.0}
            )
            entry["carbon_kg"] += stage["batch_carbon_kg"]
        for mat in row.result["materials"]:
            material_totals[mat["name"]] = material_totals.get(mat["name"], 0.0) + mat["gross_kg"] * qty
    n = len(rows)
    for entry in stage_totals.values():
        entry["carbon_kg"] = sig(entry["carbon_kg"])
    return {
        "basis": "Estimated values across all saved assessments, whole production batches.",
        "totals": {
            "products": n,
            "avg_carbon_per_unit_kg": sig(per_unit_sum / n) if n else 0,
            "total_carbon_kg": sig(carbon),
            "carbon_avoided_kg": sig(avoided),
            "carbon_avoided_pct": round(100 * avoided / carbon, 1) if carbon else 0,
            "material_saved_kg": sig(material_saved),
            "water_saved_l": sig(water_saved),
            "energy_saved_kwh": sig(energy_saved),
            "waste_saved_kg": sig(waste_saved),
            "waste_reduction_pct": round(100 * waste_saved / waste_total, 1) if waste_total else 0,
        },
        "by_stage": list(stage_totals.values()),
        "materials": [
            {"name": name, "kg": sig(kg)}
            for name, kg in sorted(material_totals.items(), key=lambda kv: kv[1], reverse=True)
        ],
        "comparison": [
            {
                "id": r.id,
                "name": r.name,
                "original": r.result["batch"]["carbon_kg"],
                "optimized": r.optimized_result["batch"]["carbon_kg"],
            }
            for r in rows
        ],
        "history": [
            {"id": r.id, "name": r.name, "date": r.created_iso, "carbon_batch_kg": r.result["batch"]["carbon_kg"]}
            for r in rows
        ],
        "recent": [r.summary() for r in reversed(rows[-5:])],
    }

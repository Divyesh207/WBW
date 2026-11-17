"""Data for the landing page's interactive Material Lab.

Nothing here is hand-written output: every number is produced by running the
real assessment, recommendation and comparison engines on the specifications
below. The same payload is served live at /api/lab and exported to the
frontend as an offline snapshot (scripts/export_lab_snapshot.py).
"""
from __future__ import annotations

import copy

from app.schemas.product import ProductSpec
from app.services.assessment_engine import METHODOLOGY_VERSION, assess
from app.services.assessment_service import run_pipeline
from app.services.demo_data import DEMO_SCENARIOS
from app.services.factors import get_factors

# One function (a 500 ml drinks bottle), five ways to make it. Masses are typical
# illustrative values: a lighter factor per kg does not help if far more mass is needed.
LAB_OPTIONS = [
    {"id": "virgin_pet", "label": "Virgin PET", "material": "virgin_plastic", "mass_kg": 0.025, "method": "blow_moulding", "waste_pct": 3, "look": "pet",
     "note": "The common single-use bottle: light, but made from fossil feedstock."},
    {"id": "recycled_pet", "label": "Recycled PET", "material": "recycled_plastic", "mass_kg": 0.025, "method": "blow_moulding", "waste_pct": 3, "look": "rpet",
     "note": "Same bottle, same mass, made from recovered plastic."},
    {"id": "glass", "label": "Glass", "material": "glass", "mass_kg": 0.28, "method": "glass_forming", "waste_pct": 5, "look": "glass",
     "note": "Low impact per kilogram, but the bottle weighs about eleven times more."},
    {"id": "aluminium", "label": "Aluminium", "material": "aluminium", "mass_kg": 0.028, "method": "stamping", "waste_pct": 10, "look": "aluminium",
     "note": "Light and endlessly recyclable, but primary aluminium is energy-intensive."},
    {"id": "recycled_aluminium", "label": "Recycled aluminium", "material": "recycled_aluminium", "mass_kg": 0.028, "method": "stamping", "waste_pct": 10, "look": "aluminium",
     "note": "Remelted scrap needs a small fraction of the energy of primary metal."},
]

LAB_SOURCES = [
    {"id": "grid_average", "label": "Grid electricity"},
    {"id": "renewable_mix", "label": "Renewable electricity"},
]

INDICATORS = [
    {"key": "carbon_kg", "label": "Carbon", "unit": "g CO2e", "scale": 1000},
    {"key": "energy_kwh", "label": "Energy", "unit": "Wh", "scale": 1000},
    {"key": "water_l", "label": "Water", "unit": "L", "scale": 1},
    {"key": "raw_material_kg", "label": "Materials", "unit": "g", "scale": 1000},
    {"key": "waste_kg", "label": "Waste", "unit": "g", "scale": 1000},
]


def lab_spec(option: dict, source_id: str) -> ProductSpec:
    """Bottle demo specification with the material, mass, process and electricity swapped."""
    factors = get_factors()
    spec = copy.deepcopy(DEMO_SCENARIOS[0]["spec"])
    method = factors.method(option["method"])
    spec["name"] = f"500 ml bottle — {option['label']}"
    spec["product_weight_kg"] = option["mass_kg"]
    spec["materials"] = [{"material_id": option["material"], "quantity_kg": option["mass_kg"]}]
    spec["manufacturing"].update(
        method=option["method"],
        # Process electricity at the indicative benchmark for the method, so options are compared fairly.
        energy_kwh_per_unit=round(method["typical_energy"] * option["mass_kg"], 5),
        energy_source=source_id,
        waste_pct=option["waste_pct"],
    )
    return ProductSpec.model_validate(spec)


def build_lab() -> dict:
    factors = get_factors()
    options = []
    for option in LAB_OPTIONS:
        results = {}
        for source in LAB_SOURCES:
            result = assess(lab_spec(option, source["id"]), factors)
            results[source["id"]] = {
                **{ind["key"]: result["per_unit"][ind["key"]] for ind in INDICATORS},
                "carbon_low_kg": result["per_unit"]["carbon_low_kg"],
                "carbon_high_kg": result["per_unit"]["carbon_high_kg"],
                "uncertainty_pct": result["data_quality"]["uncertainty_pct"],
                "stages": [{"key": s["key"], "label": s["label"], "carbon_kg": s["carbon_kg"], "share_pct": s["share_pct"]} for s in result["stages"]],
            }
        material = factors.material(option["material"])
        options.append(
            {
                "id": option["id"],
                "label": option["label"],
                "look": option["look"],
                "note": option["note"],
                "mass_g": round(option["mass_kg"] * 1000),
                "factor": material["emission_factor"],
                "results": results,
            }
        )

    demo_spec = ProductSpec.model_validate(DEMO_SCENARIOS[0]["spec"])
    demo = run_pipeline(demo_spec)
    return {
        "methodology_version": METHODOLOGY_VERSION,
        "product": "500 ml drinks bottle",
        "basis": "Per bottle. Same packaging, 400 km road transport and landfill disposal for every option; process electricity at the indicative benchmark for each method.",
        "disclaimer": demo["result"]["disclaimer"],
        "indicators": INDICATORS,
        "sources": LAB_SOURCES,
        "options": options,
        "materials": [
            {
                "id": m["id"],
                "name": m["name"],
                "family": factors.families[m["family"]],
                "emission_factor": m["emission_factor"],
                "embodied_energy": m["embodied_energy"],
                "water": m["water"],
                "durability": m["durability"],
                "notes": m["notes"],
            }
            for m in factors.raw_materials["materials"]
        ],
        "demo": {
            "name": demo_spec.name,
            "quantity": demo_spec.production_quantity,
            "carbon_per_unit_kg": demo["result"]["per_unit"]["carbon_kg"],
            "uncertainty_pct": demo["result"]["data_quality"]["uncertainty_pct"],
            "data_quality": demo["result"]["data_quality"]["rating"],
            "stages": demo["comparison"]["stages"],
            "metrics": demo["comparison"]["metrics"],
            "applied": len(demo["selected_ids"]),
            "hotspot": demo["result"]["hotspots"][0]["detail"],
            "recommendations": [
                {
                    "id": r["id"],
                    "title": r["title"],
                    "category": r["category"],
                    "verdict": r["verdict"],
                    "significance": r["significance"],
                    "feasibility": r["feasibility"],
                    "estimated_benefit": r["estimated_benefit"],
                    "trade_off": r["trade_offs"][-1] if r["verdict"] == "mixed" else r["trade_offs"][0],
                    "impact": r["impact"] and {k: r["impact"][k] for k in ("carbon_pct", "energy_pct", "water_pct", "material_pct", "waste_pct")},
                    "applied": r["id"] in demo["selected_ids"],
                }
                for r in demo["recommendations"]
            ],
        },
    }

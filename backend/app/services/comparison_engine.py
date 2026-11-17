"""Original vs. optimised comparison.

A recommendation is a list of small, explicit operations on the specification.
The optimised product is produced by applying the selected operations and then
re-running the *same* assessment engine, so a change is only reported as an
improvement if the recalculated numbers say so.
"""
from __future__ import annotations

import copy

from app.schemas.product import ProductSpec
from app.services.assessment_engine import assess, sig
from app.services.factors import FactorLibrary, get_factors

# (key in result["batch"], label, unit)
BATCH_METRICS = [
    ("carbon_kg", "Carbon footprint", "kg CO2e"),
    ("energy_kwh", "Energy consumption", "kWh"),
    ("water_l", "Water consumption", "litres"),
    ("raw_material_kg", "Material consumption", "kg"),
    ("waste_kg", "Manufacturing waste", "kg"),
]


def _resolve(root: dict, path: str) -> tuple[dict, str]:
    parts = path.split(".")
    node = root
    for part in parts[:-1]:
        node = node[part]
    return node, parts[-1]


def apply_operations(spec_dict: dict, operations: list[dict]) -> dict:
    """Apply operations to a plain-dict specification and return a new dict."""
    out = copy.deepcopy(spec_dict)
    for op in operations:
        kind = op["op"]
        if kind == "swap_material":
            moved = 0.0
            kept = []
            for m in out["materials"]:
                if m["material_id"] == op["from"]:
                    moved += m["quantity_kg"]
                else:
                    kept.append(m)
            if moved:
                for m in kept:
                    if m["material_id"] == op["to"]:
                        m["quantity_kg"] += moved
                        break
                else:
                    kept.append({"material_id": op["to"], "quantity_kg": moved})
            out["materials"] = kept
        elif kind == "set":
            node, key = _resolve(out, op["path"])
            node[key] = op["value"]
        elif kind == "scale":
            node, key = _resolve(out, op["path"])
            node[key] = node[key] * op["factor"]
        else:  # pragma: no cover - guards against a malformed dataset
            raise ValueError(f"Unknown operation '{kind}'.")
    return out


def apply_recommendations(spec: ProductSpec, recommendations: list[dict], selected_ids: list[str]) -> ProductSpec:
    """Apply the selected, applicable recommendations in their listed order."""
    chosen = set(selected_ids)
    data = spec.model_dump()
    for rec in recommendations:
        if rec["id"] in chosen and rec["applicable"]:
            data = apply_operations(data, rec["operations"])
    return ProductSpec.model_validate(data)


def _direction(pct: float | None, higher_is_better: bool = False) -> str:
    if pct is None or abs(pct) < 0.5:
        return "unchanged"
    better = pct > 0 if higher_is_better else pct < 0
    return "improved" if better else "worsened"


def compare(original: dict, optimized: dict) -> dict:
    """Compare two assessment results on a whole-batch basis."""
    metrics = []
    for key, label, unit in BATCH_METRICS:
        a, b = original["batch"][key], optimized["batch"][key]
        pct = round(100 * (b - a) / a, 1) if a else (0.0 if not b else None)
        metrics.append(
            {
                "key": key,
                "label": label,
                "unit": unit,
                "original": a,
                "optimized": b,
                "change": sig(b - a),
                "change_pct": pct,
                "direction": _direction(pct) if pct is not None else "worsened",
                "basis": "estimated",
            }
        )

    ca, cb = original["circularity"], optimized["circularity"]
    circularity = [
        {
            "key": "recyclable_fraction_pct",
            "label": "Recyclability",
            "original": f"{ca['recyclability_label']} · {ca['disposal_label']}",
            "optimized": f"{cb['recyclability_label']} · {cb['disposal_label']}",
            "direction": _direction(
                (cb["recyclable_fraction_pct"] if cb["disposal_method"] == "recycling" else 0)
                - (ca["recyclable_fraction_pct"] if ca["disposal_method"] == "recycling" else 0),
                higher_is_better=True,
            ),
        },
        {
            "key": "recycled_content_pct",
            "label": "Recycled content",
            "original": f"{ca['recycled_content_pct']:.0f}%",
            "optimized": f"{cb['recycled_content_pct']:.0f}%",
            "direction": _direction(cb["recycled_content_pct"] - ca["recycled_content_pct"], higher_is_better=True),
        },
    ]

    stage_rows = []
    for sa, sb in zip(original["stages"], optimized["stages"]):
        stage_rows.append(
            {"key": sa["key"], "label": sa["label"], "original": sa["batch_carbon_kg"], "optimized": sb["batch_carbon_kg"]}
        )

    by_key = {m["key"]: m for m in metrics}
    improved = [m["label"] for m in metrics if m["direction"] == "improved"]
    worsened = [m["label"] for m in metrics if m["direction"] == "worsened"]
    return {
        "basis": "Whole production batch, same system boundary and factors for both products.",
        "metrics": metrics,
        "circularity": circularity,
        "stages": stage_rows,
        "summary": {
            "carbon_change_pct": by_key["carbon_kg"]["change_pct"],
            "carbon_saved_kg": sig(by_key["carbon_kg"]["original"] - by_key["carbon_kg"]["optimized"]),
            "energy_saved_kwh": sig(by_key["energy_kwh"]["original"] - by_key["energy_kwh"]["optimized"]),
            "water_saved_l": sig(by_key["water_l"]["original"] - by_key["water_l"]["optimized"]),
            "material_saved_kg": sig(by_key["raw_material_kg"]["original"] - by_key["raw_material_kg"]["optimized"]),
            "waste_saved_kg": sig(by_key["waste_kg"]["original"] - by_key["waste_kg"]["optimized"]),
            "waste_change_pct": by_key["waste_kg"]["change_pct"],
            "improved": improved,
            "worsened": worsened,
        },
    }


def optimize(spec: ProductSpec, recommendations: list[dict], selected_ids: list[str], factors: FactorLibrary | None = None) -> dict:
    """Build the optimised specification, assess it and compare with the original."""
    factors = factors or get_factors()
    valid = [r["id"] for r in recommendations if r["id"] in set(selected_ids) and r["applicable"]]
    optimized_spec = apply_recommendations(spec, recommendations, valid)
    original_result = assess(spec, factors)
    optimized_result = assess(optimized_spec, factors)
    return {
        "selected_ids": valid,
        "optimized_spec": optimized_spec.model_dump(),
        "optimized_result": optimized_result,
        "comparison": compare(original_result, optimized_result),
    }

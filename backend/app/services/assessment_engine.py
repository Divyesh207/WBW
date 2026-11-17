"""Rule-based environmental screening engine.

Scope (kept identical for every assessment so results stay comparable):

    raw material production  ->  manufacturing electricity  ->  packaging
    production  ->  one transport leg to market  ->  end-of-life treatment

The use phase is excluded. Each physical flow is counted in exactly one stage:

* materials      = gross material input (net mass + scrap) x material factor
* manufacturing  = user-entered electricity x electricity factor (the method
                   benchmark is only used to flag high values, never added)
* packaging      = packaging mass x packaging factor (production only)
* transport      = (product + packaging mass) x distance x mode factor
* end_of_life    = treatment of product AND packaging, cut-off approach
                   (no recycling credit; recycled content is rewarded at the
                   material stage instead)

All factors are illustrative. This is a preliminary screening tool, not an
ISO 14040/14044 compliant Life Cycle Assessment.
"""
from __future__ import annotations

import math

from app.schemas.product import ProductSpec
from app.services.factors import FactorLibrary, get_factors

MJ_PER_KWH = 3.6

# Bump when formulas or factor datasets change. Stored assessments calculated with an
# older version are recalculated from their saved specification at startup.
METHODOLOGY_VERSION = "1.1"

DISCLAIMER = (
    "Preliminary environmental screening based on illustrative factors. All impact "
    "figures are estimates, not measurements, and this is not a certified "
    "ISO 14040/14044 Life Cycle Assessment."
)

BOUNDARY = (
    "Raw material production, manufacturing electricity, packaging production, one "
    "transport leg to market and end-of-life treatment. The use phase, capital "
    "equipment, and factory overheads are excluded."
)

STAGE_LABELS = {
    "materials": "Raw materials",
    "manufacturing": "Manufacturing energy",
    "packaging": "Packaging",
    "transport": "Transportation",
    "end_of_life": "End-of-life",
}


def sig(value: float, digits: int = 4) -> float:
    """Round to significant figures so the API never implies false precision."""
    if not value or not math.isfinite(value):
        return 0.0
    return round(value, digits - 1 - int(math.floor(math.log10(abs(value)))))


def _eol_per_kg(factors: FactorLibrary, family: str, method: str, recyclable_fraction: float) -> float:
    """End-of-life factor for 1 kg, splitting the stream where needed."""
    landfill = factors.eol_factor(family, "landfill")
    if method == "recycling":
        return recyclable_fraction * factors.eol_factor(family, "recycling") + (1 - recyclable_fraction) * landfill
    if method == "composting":
        if family in factors.eol["compostable_families"]:
            return factors.eol_factor(family, "composting")
        return landfill  # non-compostable material ends up as residual waste
    return factors.eol_factor(family, method)


def assess(spec: ProductSpec, factors: FactorLibrary | None = None) -> dict:
    """Return the full screening result for one product specification."""
    factors = factors or get_factors()
    mfg, pack, eol = spec.manufacturing, spec.packaging, spec.end_of_life
    qty = spec.production_quantity

    source = factors.energy_source(mfg.energy_source)
    method = factors.method(mfg.method)
    mode = factors.transport_mode(mfg.transport_mode)
    pack_opt = factors.packaging_option(pack.material)

    warnings: list[str] = []
    waste_frac = mfg.waste_pct / 100.0
    net_total = sum(m.quantity_kg for m in spec.materials)
    recyclable_fraction = factors.recyclable_fraction(eol.recyclability)

    # ---- 1. Raw materials (gross input including scrap) --------------------
    material_rows = []
    mat_carbon = mat_energy = mat_water = gross_total = 0.0
    mat_unc_weighted = 0.0
    eol_product = 0.0
    recycled_mass = renewable_mass = 0.0
    for item in spec.materials:
        f = factors.material(item.material_id)
        gross = item.quantity_kg / (1 - waste_frac)
        carbon = gross * f["emission_factor"]
        energy = gross * f["embodied_energy"] / MJ_PER_KWH
        water = gross * f["water"]
        mat_carbon += carbon
        mat_energy += energy
        mat_water += water
        gross_total += gross
        mat_unc_weighted += carbon * f["uncertainty_pct"]
        recycled_mass += item.quantity_kg * f["recycled_content"]
        renewable_mass += item.quantity_kg if f["renewable"] else 0.0
        eol_product += item.quantity_kg * _eol_per_kg(factors, f["family"], eol.disposal_method, recyclable_fraction)
        if eol.disposal_method == "composting" and f["family"] not in factors.eol["compostable_families"]:
            warnings.append(f"{f['name']} is not compostable; it is treated as landfilled residue.")
        material_rows.append(
            {
                "material_id": f["id"],
                "name": f["name"],
                "family": factors.families[f["family"]],
                "net_kg": item.quantity_kg,
                "gross_kg": gross,
                "carbon_kg": carbon,
                "energy_kwh": energy,
                "water_l": water,
                "emission_factor": f["emission_factor"],
                "recycled_content": f["recycled_content"],
            }
        )
    scrap = gross_total - net_total

    # ---- 2. Manufacturing electricity --------------------------------------
    mfg_carbon = mfg.energy_kwh_per_unit * source["emission_factor"]

    # ---- 3. Packaging production -------------------------------------------
    pack_carbon = pack.weight_kg * pack_opt["emission_factor"]
    pack_energy = pack.weight_kg * pack_opt["embodied_energy"] / MJ_PER_KWH
    pack_water = pack.weight_kg * pack_opt["water"]

    # ---- 4. Transport (product + packaging, one leg) ------------------------
    shipped_kg = net_total + pack.weight_kg
    transport_carbon = shipped_kg / 1000.0 * mfg.transport_distance_km * mode["emission_factor"]

    # ---- 5. End-of-life (product + packaging) ------------------------------
    eol_pack = pack.weight_kg * _eol_per_kg(
        factors, pack_opt["family"], eol.disposal_method, pack_opt["typical_recyclability"]
    )
    eol_carbon = eol_product + eol_pack

    stage_values = {
        "materials": mat_carbon,
        "manufacturing": mfg_carbon,
        "packaging": pack_carbon,
        "transport": transport_carbon,
        "end_of_life": eol_carbon,
    }
    stage_unc = {
        "materials": mat_unc_weighted / mat_carbon if mat_carbon else 0.0,
        "manufacturing": source["uncertainty_pct"],
        "packaging": pack_opt["uncertainty_pct"],
        "transport": mode["uncertainty_pct"],
        "end_of_life": factors.eol["uncertainty_pct"],
    }
    total_carbon = sum(stage_values.values())
    uncertainty = (
        sum(stage_values[k] * stage_unc[k] for k in stage_values) / total_carbon if total_carbon else 0.0
    )

    energy_total = mfg.energy_kwh_per_unit + mat_energy + pack_energy
    water_total = mfg.water_l_per_unit + mat_water + pack_water

    per_unit = {
        "carbon_kg": total_carbon,
        "carbon_low_kg": total_carbon * (1 - uncertainty / 100),
        "carbon_high_kg": total_carbon * (1 + uncertainty / 100),
        "energy_kwh": energy_total,
        "process_energy_kwh": mfg.energy_kwh_per_unit,
        "embodied_energy_kwh": mat_energy + pack_energy,
        "water_l": water_total,
        "process_water_l": mfg.water_l_per_unit,
        "embodied_water_l": mat_water + pack_water,
        "material_input_kg": gross_total,
        "packaging_kg": pack.weight_kg,
        "raw_material_kg": gross_total + pack.weight_kg,
        "waste_kg": scrap,
        "transport_carbon_kg": transport_carbon,
        "packaging_carbon_kg": pack_carbon,
        "end_of_life_carbon_kg": eol_carbon,
    }
    batch = {k: sig(v * qty) for k, v in per_unit.items()}
    per_unit_out = {k: sig(v) for k, v in per_unit.items()}
    per_unit_out["annualised_carbon_kg"] = sig(total_carbon / spec.lifespan_years)

    stages = [
        {
            "key": key,
            "label": STAGE_LABELS[key],
            "carbon_kg": sig(value),
            "batch_carbon_kg": sig(value * qty),
            "share_pct": round(100 * value / total_carbon, 1) if total_carbon else 0.0,
            "uncertainty_pct": round(stage_unc[key]),
            "basis": "estimated",
        }
        for key, value in stage_values.items()
    ]

    for row in material_rows:
        row["share_weight_pct"] = round(100 * row["net_kg"] / net_total, 1)
        row["share_carbon_pct"] = round(100 * row["carbon_kg"] / total_carbon, 1) if total_carbon else 0.0
        for key in ("net_kg", "gross_kg", "carbon_kg", "energy_kwh", "water_l"):
            row[key] = sig(row[key])

    energy_per_kg = mfg.energy_kwh_per_unit / net_total
    benchmarks = {
        "method": method["name"],
        "energy_kwh_per_kg": sig(energy_per_kg),
        "typical_energy_kwh_per_kg": method["typical_energy"],
        "energy_ratio": sig(energy_per_kg / method["typical_energy"], 3) if method["typical_energy"] else 0,
        "waste_pct": mfg.waste_pct,
        "typical_waste_pct": method["typical_waste_pct"],
    }

    circularity = {
        "recyclability": eol.recyclability,
        "recyclability_label": factors.eol["recyclability_levels"][eol.recyclability]["label"],
        "recyclable_fraction_pct": round(recyclable_fraction * 100),
        "recycled_content_pct": round(100 * recycled_mass / net_total, 1),
        "renewable_content_pct": round(100 * renewable_mass / net_total, 1),
        "disposal_method": eol.disposal_method,
        "disposal_label": factors.eol["disposal_methods"][eol.disposal_method],
        "use_type": eol.use_type,
        "repairability": eol.repairability,
        "lifespan_years": spec.lifespan_years,
    }

    hotspots = _find_hotspots(stages, material_rows, benchmarks, per_unit, net_total)

    factors_used = [
        {
            "name": f"{r['name']} — production",
            "value": r["emission_factor"],
            "unit": "kg CO2e/kg",
            "basis": factors.material(r["material_id"])["basis"],
            "source_type": factors.material(r["material_id"])["source_type"],
        }
        for r in material_rows
    ]
    factors_used += [
        {"name": f"{source['name']}", "value": source["emission_factor"], "unit": "kg CO2e/kWh", "basis": source["basis"], "source_type": source["source_type"]},
        {"name": f"{mode['name']}", "value": mode["emission_factor"], "unit": "kg CO2e/tonne-km", "basis": mode["basis"], "source_type": mode["source_type"]},
    ]
    if pack.weight_kg > 0:
        factors_used.append(
            {"name": f"{pack_opt['name']} — production", "value": pack_opt["emission_factor"], "unit": "kg CO2e/kg", "basis": pack_opt["basis"], "source_type": pack_opt["source_type"]}
        )
    factors_used.append(
        {
            "name": f"End-of-life — {circularity['disposal_label'].lower()}",
            "value": sig(eol_carbon / shipped_kg, 3) if shipped_kg else 0,
            "unit": "kg CO2e/kg (mass-weighted)",
            "basis": factors.eol["basis"],
            "source_type": "illustrative",
        }
    )

    published_share = (
        100 * mfg_carbon / total_carbon if total_carbon and source["source_type"] == "published" else 0.0
    )
    # Four evidence classes, kept separate everywhere results are shown.
    provenance = [
        {"metric": "Product, material and packaging masses", "basis": "user-provided", "note": "Entered in the specification; not measured or verified by this tool."},
        {"metric": "Manufacturing electricity, process water, scrap rate, distance", "basis": "user-provided", "note": "Entered per unit; not measured or verified by this tool."},
        {"metric": "Technology-specific electricity factors", "basis": "published factor", "note": "IPCC AR5 lifecycle medians, used only when a single generation technology is selected."},
        {"metric": "Material, packaging, transport and end-of-life factors", "basis": "illustrative assumption", "note": "Rounded values inside commonly reported ranges; not taken from a specific dataset."},
        {"metric": "Process benchmarks and substitution mass ratios", "basis": "illustrative assumption", "note": "Used to flag unusual inputs and to size alternatives."},
        {"metric": "Carbon, energy, water, material and waste results", "basis": "model estimate", "note": "User inputs multiplied by the factors above."},
    ]

    data_quality = _data_quality(uncertainty, mfg.method, warnings, published_share)

    assumptions = [
        "Functional unit: one finished unit; batch figures multiply by the production quantity.",
        "Material quantities are the mass in the finished product; gross input adds the stated scrap rate.",
        "Scrap carries its full production burden; scrap treatment and any scrap recycling are not modelled.",
        "Manufacturing emissions use only the electricity you entered. Process fuels, heat and factory overheads are excluded.",
        "Transport is a single leg from factory to market for the product and its packaging (contents excluded).",
        "End-of-life uses the cut-off approach: recycling receives no credit, so recycled content is not double-counted.",
        "The chosen disposal route is applied to both product and packaging; packaging uses its typical recyclability.",
        "Biogenic carbon uptake and storage are excluded. The use phase is excluded.",
        "Energy adds delivered process electricity to the embodied (primary) energy of materials; they are shown separately because they are not strictly the same quantity.",
        "Water is an indicative volume (process water entered plus illustrative embodied water); local water scarcity is not considered.",
        "Results are indicative single-point estimates; the range reflects factor uncertainty only, combined conservatively as if all factors were wrong in the same direction.",
        "Differences between two products that are smaller than the uncertainty range should be read as no clear difference.",
    ]

    return {
        "methodology_version": METHODOLOGY_VERSION,
        "functional_unit": "1 finished unit",
        "production_quantity": qty,
        "boundary": BOUNDARY,
        "disclaimer": DISCLAIMER,
        "per_unit": per_unit_out,
        "batch": batch,
        "stages": stages,
        "materials": material_rows,
        "benchmarks": benchmarks,
        "circularity": circularity,
        "hotspots": hotspots,
        "data_quality": data_quality,
        "factors_used": factors_used,
        "provenance": provenance,
        "assumptions": assumptions,
        "warnings": warnings,
    }


def _find_hotspots(stages, material_rows, benchmarks, per_unit, net_total) -> list[dict]:
    hotspots: list[dict] = []
    ranked = sorted(stages, key=lambda s: s["share_pct"], reverse=True)
    for i, stage in enumerate(ranked):
        share = stage["share_pct"]
        if share < 10 and i > 0:
            continue
        severity = "high" if share >= 40 else "medium" if share >= 20 else "low"
        detail = f"An estimated {share:.0f}% of the carbon footprint comes from {stage['label'][0].lower() + stage['label'][1:]}."
        if stage["key"] == "materials" and material_rows:
            top = max(material_rows, key=lambda r: r["carbon_kg"])
            detail += f" {top['name']} is the largest single contributor ({top['share_carbon_pct']:.0f}% of the total)."
        hotspots.append(
            {"id": f"stage-{stage['key']}", "area": stage["label"], "severity": severity, "share_pct": share, "indicator": "Carbon", "detail": detail}
        )

    if benchmarks["energy_ratio"] >= 1.25:
        hotspots.append(
            {
                "id": "energy-intensity",
                "area": "Process energy intensity",
                "severity": "high" if benchmarks["energy_ratio"] >= 2 else "medium",
                "share_pct": None,
                "indicator": "Energy",
                "detail": (
                    f"Entered electricity is {benchmarks['energy_kwh_per_kg']:.2g} kWh per kg, about "
                    f"{benchmarks['energy_ratio']:.1f}x the indicative benchmark for {benchmarks['method'].lower()} "
                    f"({benchmarks['typical_energy_kwh_per_kg']} kWh/kg)."
                ),
            }
        )
    if benchmarks["waste_pct"] >= max(10, 1.25 * benchmarks["typical_waste_pct"]):
        hotspots.append(
            {
                "id": "manufacturing-waste",
                "area": "Manufacturing waste",
                "severity": "high" if benchmarks["waste_pct"] >= 25 else "medium",
                "share_pct": None,
                "indicator": "Waste",
                "detail": (
                    f"{benchmarks['waste_pct']:.0f}% of input material becomes scrap "
                    f"(indicative benchmark for this method: {benchmarks['typical_waste_pct']}%)."
                ),
            }
        )
    water_per_kg = per_unit["water_l"] / net_total
    if water_per_kg >= 1000:
        top = max(material_rows, key=lambda r: r["water_l"])
        hotspots.append(
            {
                "id": "water-intensity",
                "area": "Water use",
                "severity": "high" if water_per_kg >= 5000 else "medium",
                "share_pct": None,
                "indicator": "Water",
                "detail": (
                    f"Estimated water demand is about {sig(water_per_kg, 2):,.0f} litres per kg of product, "
                    f"driven mainly by {top['name']}."
                ),
            }
        )
    return hotspots


def _data_quality(uncertainty: float, method_id: str, warnings: list[str], published_share: float = 0.0) -> dict:
    """Pedigree-style indicator.

    The scale runs to 5, but generic secondary data cannot score above 2:
    3 needs published factors for most of the footprint, 4 supplier-specific
    data and 5 measured primary data. This prototype therefore never reports
    more than "Low", however small the calculated uncertainty.
    """
    score = 2 if uncertainty <= 35 else 1
    if method_id == "other":
        score = 1
    labels = {2: "Low (screening grade)", 1: "Very low (indicative only)"}
    notes = [
        "Scale: 1 very low, 2 low (generic illustrative factors), 3 published factors for most of the footprint, 4 supplier-specific data, 5 measured primary data.",
        "Material, packaging, transport and end-of-life factors are illustrative values, not taken from a specific dataset.",
        (
            f"About {published_share:.0f}% of this footprint is calculated with a published factor (IPCC AR5 electricity median)."
            if published_share >= 0.5
            else "No published factor is used for this product; every factor is an illustrative assumption."
        ),
        f"Factor uncertainty for this product is roughly ±{round(uncertainty / 5) * 5:.0f}%.",
    ]
    if method_id == "other":
        notes.append("A generic manufacturing method was selected, so process benchmarks are less reliable.")
    notes.extend(warnings)
    return {
        "score": score,
        "max_score": 5,
        "rating": labels[score],
        "uncertainty_pct": int(round(uncertainty / 5) * 5),
        "published_share_pct": round(published_share),
        "notes": notes,
    }

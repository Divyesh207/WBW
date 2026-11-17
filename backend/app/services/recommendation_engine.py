"""Sustainable alternative recommendations.

Rules look at the specification and the assessment result and propose changes.
Every quantifiable proposal is expressed as operations on the specification and
is *re-assessed with the same engine*, so the stated benefit is a recalculated
estimate rather than an assumed one. A proposal that lowers carbon but raises
another indicator is labelled "mixed"; one that does not help is labelled
"not_beneficial" and is never pre-selected.
"""
from __future__ import annotations

from app.schemas.product import ProductSpec
from app.services.assessment_engine import assess, sig
from app.services.comparison_engine import apply_operations, compare
from app.services.factors import FactorLibrary, get_factors

MARGINAL_PCT = 5.0         # improvements below this are called out as within the noise
MIN_MATERIAL_SHARE = 0.10  # ignore swaps for materials under 10% of product mass
EFFICIENCY_CAP = 0.70      # never assume more than a 30% electricity saving
ADVISORY_BENEFIT = "Not quantified — this changes the product design or business model, so it cannot be recalculated from the current specification."


def _lc(name: str) -> str:
    """Lower-case the first letter only, so acronyms such as LDPE survive."""
    return name[:1].lower() + name[1:]


def _fmt(value: float) -> str:
    value = sig(value, 2)
    return f"{value:,.0f}" if abs(value) >= 100 else f"{value:g}"


def _impact(spec: ProductSpec, baseline: dict, operations: list[dict], factors: FactorLibrary) -> dict | None:
    try:
        new_spec = ProductSpec.model_validate(apply_operations(spec.model_dump(), operations))
    except ValueError:
        return None
    cmp = compare(baseline, assess(new_spec, factors))
    by_key = {m["key"]: m for m in cmp["metrics"]}
    return {
        "carbon_pct": by_key["carbon_kg"]["change_pct"],
        "carbon_kg": by_key["carbon_kg"]["change"],
        "energy_pct": by_key["energy_kwh"]["change_pct"],
        "water_pct": by_key["water_l"]["change_pct"],
        "material_pct": by_key["raw_material_kg"]["change_pct"],
        "waste_pct": by_key["waste_kg"]["change_pct"],
        "improved": cmp["summary"]["improved"],
        "worsened": cmp["summary"]["worsened"],
    }


def _benefit_text(impact: dict) -> str:
    labels = [("carbon_pct", "carbon"), ("energy_pct", "energy"), ("water_pct", "water"), ("material_pct", "material use"), ("waste_pct", "manufacturing waste")]
    parts = []
    for key, label in labels:
        pct = impact[key]
        if pct is not None and pct <= -0.5:
            parts.append(f"{label} about {abs(pct):.0f}% lower")
    if not parts:
        return "Recalculation shows no measurable improvement for this product."
    text = "Estimated: " + ", ".join(parts) + "."
    if impact["carbon_kg"] < 0:
        text += f" Roughly {_fmt(abs(impact['carbon_kg']))} kg CO2e avoided across the batch."
    return text


def _quantified(spec, baseline, factors, *, rec_id, category, title, current, suggestion, cost, feasibility, feasibility_note, trade_offs, operations) -> dict | None:
    impact = _impact(spec, baseline, operations, factors)
    if impact is None:
        return None
    trade_offs = list(trade_offs)
    worse_labels = {"energy_pct": "energy use", "water_pct": "water use", "material_pct": "material consumption", "waste_pct": "manufacturing waste", "carbon_pct": "the carbon footprint"}
    for key, label in worse_labels.items():
        pct = impact[key]
        if pct is not None and pct >= 0.5:
            trade_offs.append(f"Recalculation shows {label} rising by about {pct:.0f}% for this product.")
    best = max((-impact[k] for k in worse_labels if impact[k] is not None), default=0.0)
    marginal = bool(impact["improved"]) and best < MARGINAL_PCT
    benefit = _benefit_text(impact)
    if marginal:
        benefit += (
            f" This is small next to the factor uncertainty (about ±{baseline['data_quality']['uncertainty_pct']}%), "
            "so treat it as a direction rather than a confirmed saving."
        )
    if impact["improved"] and not impact["worsened"]:
        verdict = "beneficial"
    elif impact["improved"]:
        verdict = "mixed"
    else:
        verdict = "not_beneficial"
    return {
        "id": rec_id,
        "category": category,
        "title": title,
        "current_situation": current,
        "suggested_alternative": suggestion,
        "estimated_benefit": benefit,
        "cost_implications": cost,
        "feasibility": feasibility,
        "feasibility_note": feasibility_note,
        "trade_offs": trade_offs,
        "significance": "marginal" if marginal else "clear",
        "applicable": True,
        "operations": operations,
        "impact": impact,
        "verdict": verdict,
    }


def _advisory(*, rec_id, category, title, current, suggestion, cost, feasibility, feasibility_note, trade_offs, benefit=ADVISORY_BENEFIT) -> dict:
    return {
        "id": rec_id,
        "category": category,
        "title": title,
        "current_situation": current,
        "suggested_alternative": suggestion,
        "estimated_benefit": benefit,
        "cost_implications": cost,
        "feasibility": feasibility,
        "feasibility_note": feasibility_note,
        "trade_offs": trade_offs,
        "significance": "not_quantified",
        "applicable": False,
        "operations": [],
        "impact": None,
        "verdict": "advisory",
    }


def recommend(spec: ProductSpec, result: dict | None = None, factors: FactorLibrary | None = None) -> list[dict]:
    factors = factors or get_factors()
    baseline = result or assess(spec, factors)
    mfg, pack, eol = spec.manufacturing, spec.packaging, spec.end_of_life
    net_total = sum(m.quantity_kg for m in spec.materials)
    stage_share = {s["key"]: s["share_pct"] for s in baseline["stages"]}
    bench = baseline["benchmarks"]
    recs: list[dict | None] = []

    # ---- Materials: dataset-driven substitutions ---------------------------
    plastic_share = 0.0
    for item in spec.materials:
        mat = factors.material(item.material_id)
        share = item.quantity_kg / net_total
        if mat["family"] == "polymer" and not mat["recycled_content"]:
            plastic_share += share
        if share < MIN_MATERIAL_SHARE:
            continue
        for alt in mat["alternatives"]:
            target = factors.material(alt["to"])
            recs.append(
                _quantified(
                    spec, baseline, factors,
                    rec_id=f"material:{mat['id']}:{target['id']}",
                    category="Materials",
                    title=f"Replace {mat['name']} with {target['name']}",
                    current=f"{mat['name']} makes up {share * 100:.0f}% of the product by mass (illustrative factor {mat['emission_factor']} kg CO2e/kg).",
                    suggestion=f"Specify {target['name']} for the same parts (illustrative factor {target['emission_factor']} kg CO2e/kg), assuming equal mass.",
                    cost=alt["cost"],
                    feasibility=alt["feasibility"],
                    feasibility_note=alt["feasibility_note"],
                    trade_offs=alt["trade_offs"],
                    operations=[{"op": "swap_material", "from": mat["id"], "to": target["id"]}],
                )
            )

    # ---- Packaging ----------------------------------------------------------
    pack_opt = factors.packaging_option(pack.material)
    if pack.weight_kg > 0:
        alt = pack_opt.get("alternative")
        if alt:
            target = factors.packaging_option(alt["to"])
            recs.append(
                _quantified(
                    spec, baseline, factors,
                    rec_id=f"packaging:{pack_opt['id']}:{target['id']}",
                    category="Packaging",
                    title=f"Switch packaging to {_lc(target['name'])}",
                    current=f"{pack.weight_kg * 1000:.3g} g of {_lc(pack_opt['name'])} per unit.",
                    suggestion=f"Use {_lc(target['name'])} instead, assuming {alt['mass_ratio']:g}x the packaging mass for equivalent protection.",
                    cost=alt["cost"],
                    feasibility=alt["feasibility"],
                    feasibility_note=alt["feasibility_note"],
                    trade_offs=alt["trade_offs"],
                    operations=[
                        {"op": "set", "path": "packaging.material", "value": target["id"]},
                        {"op": "scale", "path": "packaging.weight_kg", "factor": alt["mass_ratio"]},
                    ],
                )
            )
        if pack.weight_kg / net_total >= 0.05:
            recs.append(
                _quantified(
                    spec, baseline, factors,
                    rec_id="packaging:lightweight",
                    category="Packaging",
                    title="Lightweight the packaging by 20%",
                    current=f"Packaging weighs {pack.weight_kg / net_total * 100:.0f}% as much as the product itself.",
                    suggestion="Right-size and down-gauge the packaging; a 20% mass reduction is used here as an illustrative design target.",
                    cost="Usually saves money through lower material and freight spend; may need a one-off redesign and transit testing.",
                    feasibility="Medium",
                    feasibility_note="Achievable saving depends on how optimised the current pack already is.",
                    trade_offs=[
                        "Less packaging can increase product damage in transit; damaged goods usually outweigh the packaging saving.",
                        "The 20% figure is a target, not a verified result.",
                    ],
                    operations=[{"op": "scale", "path": "packaging.weight_kg", "factor": 0.8}],
                )
            )
        if spec.production_quantity >= 1000 and eol.use_type == "single_use":
            recs.append(
                _advisory(
                    rec_id="packaging:reusable",
                    category="Packaging",
                    title="Consider reusable transit packaging",
                    current="Packaging is produced new for every unit shipped.",
                    suggestion="Where deliveries return to the same sites, use returnable crates or totes for the transit layer.",
                    cost="Higher up-front cost and reverse-logistics spend; pays back only with enough reuse cycles.",
                    feasibility="Low",
                    feasibility_note="Needs a closed delivery loop and a return system.",
                    trade_offs=[
                        "Return transport and washing add impacts; benefit depends on the number of reuse cycles actually achieved.",
                        "Not practical for one-way or export distribution.",
                    ],
                )
            )

    # ---- Manufacturing energy ----------------------------------------------
    if mfg.energy_kwh_per_unit > 0:
        ratio = bench["energy_ratio"]
        if ratio >= 1.25:
            factor = max(1 / ratio, EFFICIENCY_CAP)
            current = f"Electricity use is about {ratio:.1f}x the indicative benchmark for {_lc(bench['method'])}."
        elif stage_share["manufacturing"] >= 15:
            factor = 0.9
            current = f"Manufacturing electricity is an estimated {stage_share['manufacturing']:.0f}% of the footprint."
        else:
            factor = None
        if factor:
            recs.append(
                _quantified(
                    spec, baseline, factors,
                    rec_id="energy:efficiency",
                    category="Manufacturing",
                    title="Improve manufacturing energy efficiency",
                    current=current,
                    suggestion=f"Target a {round((1 - factor) * 100)}% cut in electricity per unit through efficient drives, heat recovery, compressed-air fixes and shorter cycle times.",
                    cost="Low-cost measures often pay back within one to three years; equipment replacement needs capital.",
                    feasibility="Medium",
                    feasibility_note="Needs an energy audit to confirm where the savings are.",
                    trade_offs=[
                        "The reduction is an illustrative target, not a measured saving.",
                        "Savings shrink if the line already runs efficient modern equipment.",
                    ],
                    operations=[{"op": "scale", "path": "manufacturing.energy_kwh_per_unit", "factor": round(factor, 3)}],
                )
            )
        source = factors.energy_source(mfg.energy_source)
        if not source["renewable"]:
            target = factors.energy_source("renewable_mix")
            recs.append(
                _quantified(
                    spec, baseline, factors,
                    rec_id="energy:renewable",
                    category="Manufacturing",
                    title="Source renewable electricity",
                    current=f"Production runs on {_lc(source['name'])} ({source['emission_factor']} kg CO2e/kWh, illustrative).",
                    suggestion=f"Move to {_lc(target['name'])} through on-site generation or a credible supply contract ({target['emission_factor']} kg CO2e/kWh, illustrative).",
                    cost="On-site solar needs capital but lowers running cost; green tariffs and certificates add a small premium.",
                    feasibility="Medium",
                    feasibility_note="Depends on site, local market and contract options.",
                    trade_offs=[
                        "Certificates alone may not add new renewable capacity; quality of the contract matters.",
                        "Does not reduce the amount of energy used, only its carbon intensity.",
                        "Supply may not cover 100% of demand at all hours.",
                    ],
                    operations=[{"op": "set", "path": "manufacturing.energy_source", "value": target["id"]}],
                )
            )

    # ---- Manufacturing waste -----------------------------------------------
    typical = bench["typical_waste_pct"]
    if mfg.waste_pct >= max(10, 1.25 * typical):
        new_waste = max(float(typical), round(mfg.waste_pct * 0.6, 1))
        recs.append(
            _quantified(
                spec, baseline, factors,
                rec_id="process:waste",
                category="Manufacturing",
                title="Reduce manufacturing scrap",
                current=f"{mfg.waste_pct:g}% of input material is lost as scrap (indicative benchmark {typical}%).",
                suggestion=f"Aim for about {new_waste:g}% through better nesting and cutting layouts, tighter process control and near-net-shape production.",
                cost="Mostly process and tooling changes; saves purchased material directly.",
                feasibility="Medium",
                feasibility_note="Achievable rate depends on part geometry and process capability.",
                trade_offs=[
                    "Tighter nesting can slow production or constrain design freedom.",
                    "The target scrap rate is illustrative and must be validated on the line.",
                ],
                operations=[{"op": "set", "path": "manufacturing.waste_pct", "value": new_waste}],
            )
        )

    # ---- Transport ----------------------------------------------------------
    mode = factors.transport_mode(mfg.transport_mode)
    alt = mode.get("alternative")
    if alt and mfg.transport_distance_km >= max(alt["min_distance_km"], 1):
        target = factors.transport_mode(alt["to"])
        recs.append(
            _quantified(
                spec, baseline, factors,
                rec_id=f"transport:{mode['id']}:{target['id']}",
                category="Logistics",
                title=f"Shift freight from {_lc(mode['name'])} to {_lc(target['name'])}",
                current=f"{mfg.transport_distance_km:,.0f} km by {_lc(mode['name'])} ({mode['emission_factor']} kg CO2e/tonne-km, illustrative).",
                suggestion=f"Move the main leg to {_lc(target['name'])} ({target['emission_factor']} kg CO2e/tonne-km, illustrative), assuming the same distance.",
                cost="Usually cheaper per tonne-km, but with longer and less flexible lead times.",
                feasibility="Medium" if mode["id"] == "road" else "High",
                feasibility_note="Needs suitable terminals at both ends and planning for longer transit.",
                trade_offs=[
                    "Longer lead times mean more stock in the pipeline.",
                    "First- and last-mile road legs are still needed and are not modelled here.",
                ],
                operations=[{"op": "set", "path": "manufacturing.transport_mode", "value": target["id"]}],
            )
        )

    # ---- End-of-life --------------------------------------------------------
    if eol.disposal_method in ("landfill", "incineration") and eol.recyclability in ("high", "medium"):
        rec = _quantified(
            spec, baseline, factors,
            rec_id="eol:recycling",
            category="End-of-life",
            title="Design and label the product for recycling",
            current=f"The product is rated {baseline['circularity']['recyclability_label'].lower()} for recyclability but is expected to go to {eol.disposal_method}.",
            suggestion="Add clear recycling labelling and support a collection or take-back route so the recyclable share is actually recovered.",
            cost="Labelling is low-cost; take-back schemes carry ongoing logistics cost.",
            feasibility="Medium",
            feasibility_note="Depends on local collection infrastructure, which the manufacturer does not control.",
            trade_offs=[
                "Real recycling rates depend on consumer behaviour and local facilities.",
                "No credit is given for the recycled material itself (cut-off approach), so the modelled benefit is deliberately conservative.",
            ],
            operations=[{"op": "set", "path": "end_of_life.disposal_method", "value": "recycling"}],
        )
        if rec and rec["verdict"] == "not_beneficial":
            # Cut-off approach: recycling earns no carbon credit, so say what it does achieve.
            recoverable = net_total * factors.recyclable_fraction(eol.recyclability) * spec.production_quantity
            rec.update(
                verdict="advisory",
                significance="not_quantified",
                applicable=False,
                operations=[],
                impact=None,
                estimated_benefit=(
                    "Not visible in the carbon estimate, because recycling earns no credit under the cut-off approach. "
                    f"The benefit is material recovery: roughly {_fmt(recoverable)} kg across the batch could return to use instead of being discarded."
                ),
            )
        recs.append(rec)
    if eol.recyclability in ("low", "none"):
        recs.append(
            _advisory(
                rec_id="design:recyclability",
                category="Design",
                title="Design for recyclability",
                current=f"Recyclability is rated {baseline['circularity']['recyclability_label'].lower()}.",
                suggestion="Prefer mono-material parts, avoid permanent bonding of different materials, and use separable fasteners and compatible labels and inks.",
                cost="Mostly design-time effort; may change tooling.",
                feasibility="Medium",
                feasibility_note="Easiest to do now, before tooling is committed.",
                trade_offs=["Mono-material designs can limit barrier, strength or appearance options."],
            )
        )

    # ---- Product design: reuse, durability, repair --------------------------
    if eol.use_type == "single_use" and plastic_share >= 0.5:
        recs.append(
            _advisory(
                rec_id="design:reusable",
                category="Design",
                title="Evaluate a reusable product design",
                current="A single-use product made mostly of virgin plastic.",
                suggestion="Assess a durable, refillable or returnable version (for example stainless steel, glass or thick-walled recycled plastic) for the same function.",
                cost="Higher unit cost; may need a refill or return model.",
                feasibility="Low",
                feasibility_note="Changes the product and business model, not just the specification.",
                trade_offs=[
                    "A reusable item has a higher footprint per unit and only wins after enough uses — the break-even count must be assessed separately.",
                    "Washing and return transport add water, energy and emissions.",
                    "Heavier materials raise transport impact.",
                ],
            )
        )
    if eol.use_type == "reusable" and spec.lifespan_years < 3:
        recs.append(
            _advisory(
                rec_id="design:durability",
                category="Design",
                title="Extend product lifespan with more durable materials",
                current=f"Expected lifespan is {spec.lifespan_years:g} years, so the footprint is spread over a short service life.",
                suggestion="Strengthen wear points, specify more durable materials and finishes, and offer spare parts.",
                cost="Moderately higher material cost; can support a longer warranty.",
                feasibility="Medium",
                feasibility_note="Needs durability testing to confirm.",
                trade_offs=[
                    "More durable materials can carry a higher footprint per kg.",
                    "Benefit only materialises if users actually keep the product longer.",
                ],
                benefit=f"Illustrative: doubling the service life would halve the annualised footprint (currently about {_fmt(baseline['per_unit']['annualised_carbon_kg'])} kg CO2e per unit per year), provided the product is not redesigned to be heavier.",
            )
        )
    if eol.repairability == "low":
        recs.append(
            _advisory(
                rec_id="design:repair",
                category="Design",
                title="Design for repair",
                current="Repairability is rated low.",
                suggestion="Use standard fasteners instead of adhesives, make wear parts replaceable and publish repair information.",
                cost="Small design and documentation cost; spare-parts supply has an ongoing cost.",
                feasibility="Medium",
                feasibility_note="Best decided before the design is frozen.",
                trade_offs=[
                    "Modular construction can add material and weight.",
                    "Benefit depends on users actually repairing rather than replacing.",
                ],
            )
        )

    order = {"beneficial": 0, "mixed": 1, "advisory": 2, "not_beneficial": 3}
    out = [r for r in recs if r]
    out.sort(key=lambda r: (order[r["verdict"]], (r["impact"] or {}).get("carbon_pct") or 0))
    return out


def default_selection(recommendations: list[dict]) -> list[str]:
    """Pre-select only changes that improve at least one indicator without worsening another."""
    return [r["id"] for r in recommendations if r["applicable"] and r["verdict"] == "beneficial"]

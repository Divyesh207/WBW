# Technical Audit Report

Waste Before Waste · audit of the environmental calculation and recommendation engines
Scope: `backend/app/services/assessment_engine.py`, `recommendation_engine.py`, `comparison_engine.py`, `assessment_service.py` and the factor datasets in `backend/app/data/`.

## 1. Summary

The calculation logic is arithmetically correct and internally consistent: stage formulas match their descriptions, the total equals the sum of the stages, and no flow is counted twice. The weaknesses found were about **how results were labelled and how confident they appeared**, not about arithmetic.

Seven issues were corrected in methodology version 1.1. Nine limitations remain and are documented rather than hidden.

| | Count |
| --- | --- |
| Calculation errors found | 0 |
| Double-counting found | 0 |
| Misleading or over-confident presentation — corrected | 7 |
| Limitations remaining (documented) | 9 |

## 2. What was checked

| Check | Method | Result |
| --- | --- | --- |
| Each stage formula | Hand calculation against the demo bottle (tests in `test_assessment_engine.py`) | Correct |
| Total = sum of stages; shares sum to 100% | Automated test | Correct |
| Batch scaling | Doubling quantity doubles batch results, leaves per-unit unchanged | Correct |
| Double-counting of recycling | Cut-off: recycled content rewarded at material stage, no end-of-life credit | None |
| Double-counting of process energy | Method benchmark is diagnostic only, never added | None |
| Double-counting of packaging | Production in "packaging", treatment in "end-of-life" | None |
| Recommendation benefit | Reported % equals an independent recalculation | Correct |
| Combined recommendations | Recalculated together, not summed | Correct |
| Units | kg, kWh, L, tonne-km conversions | Correct |

## 3. Findings and corrections

### F1 — Data quality was rated too generously (corrected)
**Problem.** A product could be rated "Moderate, 3 of 5" although every factor was an illustrative assumption. That overstated reliability.
**Correction.** The scale is now defined explicitly (1 very low … 5 measured primary data) and generic data is capped at **2, "Low (screening grade)"**. The indicator also reports the share of the footprint calculated with published factors.

### F2 — No factor came from a citable source (partly corrected)
**Problem.** All factors were described as "illustrative, within commonly reported ranges". None could be traced to a specific table.
**Correction.** The five technology-specific electricity factors now reproduce the IPCC AR5 WGIII Annex III lifecycle medians (coal 0.82, gas 0.49, rooftop PV 0.041, onshore wind 0.011, hydro 0.024 kg CO2e/kWh) and are tagged `published`. Every other factor is tagged `illustrative`. A test fails if a factor claims to be published without naming its source.
**Remaining.** Material, packaging, transport and end-of-life factors are still illustrative.

### F3 — Evidence classes were blurred (corrected)
**Problem.** Results distinguished only "user-provided", "calculated" and "estimated". User inputs could be read as measurements, and published and assumed factors were not separated.
**Correction.** Four classes are used everywhere: *user-provided* (explicitly "not measured or verified"), *published factor*, *illustrative assumption*, *model estimate*. Each factor row in the interface, the PDF and the JSON export carries its class.

### F4 — Small differences were presented as improvements (corrected)
**Problem.** A 2% carbon reduction was shown as a benefit although the factor uncertainty is ±30%. Such a difference cannot be distinguished from noise.
**Correction.** A recommendation whose best improvement is below 5% is marked **marginal** and its text states that it is small next to the uncertainty. In the bottle demo this applies to packaging lightweighting and the efficiency measure.

### F5 — Energy total mixed two kinds of energy (documented, labelled)
**Problem.** The energy indicator adds delivered process electricity (kWh) to the embodied primary energy of materials (MJ converted to kWh). These are not strictly the same quantity.
**Correction.** Process and embodied energy were already shown separately; the assumption list now states the inconsistency plainly. A full fix needs primary-energy factors for electricity.

### F6 — Saved results could go stale (corrected)
**Problem.** Assessments store their calculated results. After a factor change, old assessments would silently show numbers from the previous factors.
**Correction.** Results carry a `methodology_version`. On startup, assessments from an older version are recalculated from their saved specification. Specifications and the user's selected recommendations are preserved; nothing is deleted.

### F7 — Dashboard average was easy to misread (corrected)
**Problem.** "Average carbon footprint per unit" averages unrelated products (a 25 g bottle and a 6.5 kg table). It is not a benchmark.
**Correction.** The card now says it is a mean across different product types and not a benchmark.

### Also reviewed — no change needed
- **Biogenic carbon.** Uptake and biogenic CO2 are excluded, while landfill methane from paper and wood is included. This is the standard convention, not an inconsistency.
- **Uncertainty combination.** Linear (fully correlated) combination overstates rather than understates the range. Kept, and stated.
- **"Not automatically better."** Confirmed: mixed and non-beneficial alternatives are never pre-selected (automated test).
- **Recycling recommendation with no carbon benefit.** Under the cut-off approach recycling earns no credit; the platform reports the recoverable mass instead of inventing a carbon saving.

## 4. Scientific reliability against LCA practice

| Principle | Status | Comment |
| --- | --- | --- |
| Functional unit | Partial | "One unit" is defined and consistent, but ignores number of uses. Reusable products are disadvantaged per unit; an annualised figure is shown as a partial remedy. |
| System boundary | Consistent, incomplete | Same boundary for every product. Use phase, process heat, inbound transport and scrap treatment are excluded and listed. |
| Allocation | Sound | Cut-off approach applied consistently at both ends. |
| Material sourcing | Generic | No regional or supplier differentiation. |
| Manufacturing | Simplified | Electricity only; depends entirely on the user's kWh figure. |
| Transport | Simplified | One leg, average vehicle, no load factor or return trip. |
| End of life | Simplified | One route for product and packaging; fixed recyclable fractions. |
| Data quality | Now honest | Capped at "Low"; published share reported. |
| Uncertainty | Indicative | Factor uncertainty only; conservative combination. |
| Impact categories | Narrow | Carbon, energy, water volume, material, waste. No toxicity, land use, scarcity. |
| Critical review | None | Not peer-reviewed; cannot support public comparative claims. |

## 5. Recommendation engine review

- **Strength.** Benefits are recalculated with the same engine on a modified specification, so a recommendation cannot claim an improvement the model does not produce.
- **Strength.** The verdict considers five indicators, and a worsening in any of them prevents pre-selection.
- **Weakness.** Ranking inside a verdict group uses carbon only.
- **Weakness.** Cost, feasibility, durability and recyclability are qualitative; toxicity is absent.
- **Weakness.** Rules are fixed. Alternatives exist only for materials that list one in the dataset (four material swaps, three packaging swaps).
- **Weakness.** Material swaps assume equal mass. The landing-page lab deliberately shows why this matters: glass has a lower factor per kg than PET but a far higher footprint per bottle.

## 6. Remaining limitations

1. Illustrative factors for materials, packaging, transport and end of life.
2. No process heat or fuels.
3. No use phase; per-unit functional unit.
4. One transport leg, no inbound logistics.
5. Equal-mass substitution.
6. Scrap treatment and recycling not modelled.
7. Water volume, not water scarcity.
8. Five indicators; no toxicity or land use.
9. Uncertainty excludes user-input and model-structure uncertainty.

## 7. Verification

| Test | Result |
| --- | --- |
| Backend test suite | 43 passed (35 existing + 8 added for this audit) |
| Published factors equal the IPCC medians | Passed |
| No material factor claims a published source | Passed |
| Four evidence classes present in every result | Passed |
| Data quality never exceeds 2 | Passed |
| Marginal changes flagged | Passed |
| Stale assessments recalculated, specification preserved | Passed |
| Landing-page values equal direct engine output | Passed |

## 8. Files changed by the audit

- `backend/app/data/energy_factors.json` — published electricity factors, source tags
- `backend/app/services/factors.py` — `source_type` on every factor
- `backend/app/services/assessment_engine.py` — version, evidence classes, data-quality scale, assumptions
- `backend/app/services/recommendation_engine.py` — marginal-change flag
- `backend/app/services/assessment_service.py`, `backend/app/main.py` — recalculation of stale results
- `backend/app/services/landing_lab.py`, `backend/scripts/export_lab_snapshot.py`, `GET /api/lab` — engine-backed landing data
- `backend/tests/test_methodology_v11.py` — new tests

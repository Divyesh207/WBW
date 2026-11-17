# Environmental Calculation Methodology

Waste Before Waste · methodology version 1.1

This document describes exactly what the code in `backend/app/services/` calculates. Every formula below is implemented as written; every worked number can be reproduced with the demo scenario *Single-use plastic water bottle*.

> **Status.** This is a preliminary screening model. Most factors are illustrative values, not entries from a licensed database. Results are model estimates, not measurements, and this is not an ISO 14040/14044 compliant Life Cycle Assessment.

---

## 1. The idea in plain language

1. The user tells us **what the product is made of and how it is made**: masses, electricity, water, scrap rate, transport, packaging and what happens at end of life.
2. For each of those inputs we hold a **factor** — a number that says "one kilogram of this material (or one kWh, or one tonne-kilometre) causes about this much impact".
3. We **multiply each input by its factor** and add the results up, stage by stage.
4. We look for **hotspots**: the stages and choices responsible for most of the total.
5. For each hotspot we try a **specific alternative** (a different material, cleaner electricity, less scrap…), change the specification accordingly, and **run the same calculation again**.
6. We show the **original and the recalculated product side by side**, including anything that got worse.

Nothing is "predicted" by a black box. The whole model is multiplication and addition with visible inputs.

## 2. Scope

| Item | Choice |
| --- | --- |
| Functional unit | One finished unit of the product. Batch figures are the per-unit result × production quantity. |
| System boundary | Raw material production → manufacturing electricity → packaging production → one transport leg to market → end-of-life treatment. |
| Excluded | Use phase; process heat and fuels; factory overheads; capital equipment; inbound transport of raw materials; treatment of manufacturing scrap; biogenic carbon uptake and storage. |
| Indicators | Carbon footprint (kg CO2e), energy (kWh), water (litres), raw material consumption (kg), manufacturing waste (kg). |
| Allocation | Cut-off (recycled-content) approach. Recycled material enters free of its first life's burdens; recycling at end of life earns **no** credit. |
| Single score | **None.** Indicators are never weighted into one number (see §9). |

## 3. Symbols

| Symbol | Meaning | Unit | Origin |
| --- | --- | --- | --- |
| mᵢ | mass of material *i* in one finished unit | kg | user |
| w | manufacturing scrap rate (0–0.9) | fraction | user |
| EFᵢ | emission factor of material *i* | kg CO2e/kg | dataset |
| E | process electricity per unit | kWh | user |
| EF_el | electricity emission factor | kg CO2e/kWh | dataset |
| m_p | packaging mass per unit | kg | user |
| EF_p | packaging emission factor | kg CO2e/kg | dataset |
| d | transport distance | km | user |
| EF_t | transport factor | kg CO2e/tonne-km | dataset |
| EF_eol | end-of-life factor for a material family and route | kg CO2e/kg | dataset |
| r | recyclable fraction (high 0.85, medium 0.5, low 0.2, none 0) | fraction | dataset |
| Q | production quantity | units | user |

## 4. Carbon footprint

The reference inputs are the demo bottle: 25 g virgin PET, 3% scrap, 0.035 kWh grid electricity, 4 g LDPE film, 400 km by road, landfill, 10,000 units.

### 4.1 Raw materials

```
gross input      Gᵢ = mᵢ / (1 − w)
material carbon  C_mat = Σ Gᵢ × EFᵢ
```

Scrap is material that was produced but did not end up in the product, so the footprint uses the *gross* input.

*Example.* G = 0.025 / (1 − 0.03) = 0.02577 kg. C_mat = 0.02577 × 3.0 = **0.0773 kg CO2e**.

### 4.2 Manufacturing energy

```
C_mfg = E × EF_el
```

Only the electricity the user enters is counted. The manufacturing *method* supplies a benchmark (kWh per kg) that is used to flag unusually high values; it is never added to the footprint, which would double-count.

*Example.* 0.035 kWh × 0.48 = **0.0168 kg CO2e**.

### 4.3 Packaging

```
C_pack = m_p × EF_p
```

*Example.* 0.004 kg × 2.6 = **0.0104 kg CO2e**.

### 4.4 Transportation

```
C_trans = (Σ mᵢ + m_p) / 1000 × d × EF_t
```

Product and packaging mass, converted to tonnes, over one leg from factory to market.

*Example.* (0.025 + 0.004) / 1000 × 400 × 0.10 = **0.00116 kg CO2e**.

### 4.5 End of life

```
per-kg factor f(family, route):
  landfill / incineration   f = EF_eol[family][route]
  recycling                 f = r × EF_eol[family][recycling] + (1 − r) × EF_eol[family][landfill]
  composting                f = EF_eol[family][composting]   if the material is compostable
                            f = EF_eol[family][landfill]     otherwise (with a warning)

C_eol = Σ mᵢ × f(familyᵢ, route) + m_p × f(family_p, route)
```

The same route applies to product and packaging; packaging uses its own typical recyclability. Recycling counts collection and sorting only.

*Example.* (0.025 + 0.004) × 0.05 = **0.00145 kg CO2e**.

### 4.6 Total

```
C_unit  = C_mat + C_mfg + C_pack + C_trans + C_eol
C_batch = C_unit × Q
share of a stage = stage / C_unit × 100
annualised = C_unit / lifespan in years
```

*Example.* 0.0773 + 0.0168 + 0.0104 + 0.00116 + 0.00145 = **0.107 kg CO2e per bottle**, **1,071 kg** for 10,000. Raw materials are 72% of the total.

## 5. Energy, water, materials and waste

```
Energy (kWh)   = E + Σ Gᵢ × EEᵢ / 3.6 + m_p × EE_p / 3.6        EE = embodied energy, MJ/kg
Water (L)      = W + Σ Gᵢ × WFᵢ + m_p × WF_p                    W = process water per unit
Raw material   = Σ Gᵢ + m_p
Waste (kg)     = Σ Gᵢ − Σ mᵢ
```

*Example.*
- Energy: 0.035 + 0.02577 × 80 / 3.6 + 0.004 × 78 / 3.6 = 0.035 + 0.573 + 0.087 = **0.694 kWh**.
- Water: 0.1 + 0.02577 × 60 + 0.004 × 50 = **1.85 L**.
- Raw material: 0.02577 + 0.004 = **0.0298 kg**.
- Waste: 0.02577 − 0.025 = **0.00077 kg** (7.7 kg per batch).

Process and embodied parts are always shown separately. Process electricity is delivered energy and embodied energy is primary energy, so their sum is an indicative "energy demand", not a strict physical total.

## 6. Uncertainty and data quality

Each factor carries an uncertainty percentage. For the carbon total they are combined as a contribution-weighted average:

```
u_stage(materials) = Σ carbonᵢ × uᵢ / Σ carbonᵢ
u_total            = Σ stage carbon × u_stage / C_unit
range              = C_unit × (1 ± u_total)
```

This treats all errors as pointing the same way, which is deliberately conservative (it gives a wider range than assuming independent errors).

*Example.* (0.0773×30 + 0.0168×25 + 0.0104×30 + 0.00116×30 + 0.00145×50) / 0.107 ≈ **±30%**, a range of 0.076–0.139 kg CO2e.

**Data-quality indicator (1–5).**

| Level | Meaning | Reachable in this prototype |
| --- | --- | --- |
| 1 | Very low — uncertainty above ±35% or a generic process | yes |
| 2 | Low — generic illustrative factors | yes (maximum) |
| 3 | Published factors for most of the footprint | no |
| 4 | Supplier-specific data | no |
| 5 | Measured primary data | no |

The indicator also reports what share of the footprint was calculated with a published factor.

Results are rounded to four significant figures in the API and three in the interface, so they never suggest more precision than the factors have.

## 7. Where the numbers come from

Every value shown is tagged with one of four evidence classes.

| Class | What it covers |
| --- | --- |
| **User-provided** | Masses, electricity, process water, scrap rate, distance. Entered by the user; not measured or verified by the tool. |
| **Published factor** | Technology-specific electricity factors (see below). |
| **Illustrative assumption** | Material, packaging, transport and end-of-life factors; process benchmarks; mass ratios for packaging swaps. |
| **Model estimate** | Every carbon, energy, water, material and waste result. |

### 7.1 Published factors actually implemented

| Factor | Value | Source |
| --- | --- | --- |
| Coal-fired electricity | 0.82 kg CO2e/kWh | IPCC AR5 WGIII (2014), Annex III, Table A.III.2, lifecycle median |
| Natural gas electricity (combined cycle) | 0.49 | same |
| Rooftop solar PV | 0.041 | same |
| Onshore wind | 0.011 | same |
| Hydropower | 0.024 | same |

These are technology medians, not location-specific grid mixes.

### 7.2 Illustrative factors

All other factors live in `backend/app/data/*.json`. They are rounded figures chosen to sit inside ranges commonly reported in public literature, and each records its assumed basis and uncertainty. Examples:

| Material | kg CO2e/kg | MJ/kg | L/kg |
| --- | --- | --- | --- |
| Virgin plastic (PET) | 3.0 | 80 | 60 |
| Recycled plastic (rPET) | 1.2 | 30 | 20 |
| Aluminium (primary) | 12.0 | 190 | 80 |
| Recycled aluminium | 1.2 | 20 | 12 |
| Glass | 1.2 | 15 | 15 |
| Cotton (conventional) | 5.0 | 55 | 8,000 |

| Other factor | Value |
| --- | --- |
| Grid electricity, average mix | 0.48 kg CO2e/kWh |
| Road / rail / sea / air freight | 0.10 / 0.025 / 0.012 / 0.60 kg CO2e/tonne-km |
| Polymer to landfill / incineration | 0.05 / 2.4 kg CO2e/kg |
| Paper and board to landfill | 1.0 kg CO2e/kg |

**The platform does not use ecoinvent, DEFRA, EPA or EEA data.** The table in §7.3 describes sources that could replace the illustrative values.

### 7.3 Candidate data sources

| Source | Covers | Access | Suitability |
| --- | --- | --- | --- |
| IPCC (AR5/AR6 reports, Emission Factor Database) | GWP values, electricity technologies, sector defaults | Free | Used for electricity technologies; best source for GWP values |
| UK Government GHG Conversion Factors (DEFRA/DESNZ) | Electricity, fuels, freight, material use, waste disposal | Free, updated yearly | **Best next step** for transport, electricity and waste; UK-centric |
| U.S. EPA (Emission Factors Hub, WARM, eGRID, USEEIO) | Fuels, electricity by region, end-of-life by material | Free | Good for end-of-life (WARM) and US grids |
| European Environment Agency | Grid intensity by EU country | Free | Good for country-specific electricity |
| ICE Database (Circular Ecology) | Embodied carbon and energy of materials | Free | **Best free source for material factors** |
| openLCA Nexus | Hosts many databases | Mixed: some free (e.g. USLCI, Agribalyse, ELCD), some paid | Free sets usable with openLCA |
| ecoinvent | Thousands of processes, all indicators | **Paid licence** | Gold standard; not affordable for a prototype |
| Peer-reviewed LCA studies | Specific products | Journal access varies | Useful to sanity-check one product, not as a general dataset |

Recommended for the next version: ICE for materials, DEFRA/DESNZ for transport, electricity and waste, EPA WARM as a cross-check for end of life, IPCC for GWP. To adopt them, replace the JSON entries, set `"source_type": "published"` and cite the table and year in `basis`. No calculation code changes.

## 8. Hotspots

| Hotspot | Rule |
| --- | --- |
| Life-cycle stage | Every stage with ≥10% of the carbon total, plus the largest. High ≥40%, medium ≥20%. |
| Process energy intensity | (E / product mass) ≥ 1.25 × benchmark for the method. |
| Manufacturing waste | Scrap rate ≥ max(10%, 1.25 × benchmark). |
| Water | Total water ≥ 1,000 L per kg of product. |

## 9. Scoring

There is **no composite environmental score**. Combining carbon, water and waste into one number requires weighting factors, which are value judgements that ISO 14044 treats as optional and unsuitable for comparative claims. Instead:

- The headline figure is the carbon footprint, with its range.
- Other indicators are reported beside it, in their own units.
- Each recommendation receives a **verdict** based on all five indicators (§10.4).

## 10. Recommendation engine

### 10.1 When is an alternative proposed?

| Trigger | Proposal |
| --- | --- |
| A material is ≥10% of product mass and the dataset lists an alternative | Swap it (virgin PET→rPET, aluminium→recycled aluminium, paper→recycled paper, cotton→organic cotton) |
| Packaging material has a listed alternative | Swap it, with a mass ratio (e.g. film→board needs 2× the mass) |
| Packaging ≥5% of product mass | Lightweight by 20% (illustrative target) |
| Energy intensity ≥1.25× benchmark, or manufacturing ≥15% of footprint | Efficiency improvement (capped at 30%) |
| Electricity source is not renewable | Renewable electricity |
| Scrap ≥ max(10%, 1.25× benchmark) | Reduce scrap toward the benchmark |
| Air freight, or road over 800 km | Shift to sea or rail |
| Landfill/incineration with medium or high recyclability | Design and label for recycling |
| Single-use and mostly virgin plastic; short lifespan; low repairability or recyclability | Design advice (not quantified) |

### 10.2 How is the benefit calculated?

Each quantifiable proposal is a list of operations on the specification, for example `swap_material(virgin_plastic → recycled_plastic)`. The engine applies them to a copy of the specification, runs the **same** assessment, and reports the percentage change in each of the five indicators. The benefit is therefore recalculated, never assumed.

### 10.3 Worked example: virgin PET → recycled PET

| Indicator (10,000 bottles) | Original | With rPET | Change |
| --- | --- | --- | --- |
| Carbon | 1,071 kg CO2e | 607 kg CO2e | −43% |
| Energy | 6,944 kWh | 3,364 kWh | −52% |
| Water | 18,460 L | 8,155 L | −56% |
| Raw material | 298 kg | 298 kg | no change |
| Waste | 7.7 kg | 7.7 kg | no change |

The whole difference comes from one line: 0.02577 kg × (3.0 − 1.2) = 0.0464 kg CO2e per bottle.

- *Recyclability:* unchanged — rPET is as recyclable as virgin PET.
- *Cost:* often a small premium; food-grade grades usually cost more.
- *Trade-offs:* less consistent colour and clarity; food contact needs certified grades; assumes equal mass.

### 10.4 How is "better" decided?

For each of the five indicators: **improved** if it falls by at least 0.5%, **worsened** if it rises by at least 0.5%.

| Verdict | Condition | Pre-selected? |
| --- | --- | --- |
| Beneficial | At least one indicator improves and none worsens | Yes |
| Mixed | Some improve, some worsen | No |
| Not beneficial | Nothing improves | No |
| Advisory | Changes the design or business model; cannot be recalculated | Cannot be applied |

A change whose best improvement is under 5% is additionally marked **marginal**, with a note that it is small compared with the factor uncertainty.

*Example of a mixed result.* Replacing 4 g of plastic film with 8 g of recycled board lowers energy by 9% but raises material use by 13% and carbon by 2% when the board is landfilled. The platform shows this and does not pre-select it.

### 10.5 Ranking

Beneficial first, then mixed, then advisory, then not beneficial. Within a group, by carbon change (largest reduction first).

### 10.6 What is and is not considered

| Criterion | Treatment |
| --- | --- |
| Carbon, energy, water, material use, waste | Quantified by recalculation |
| Cost, feasibility | Qualitative text per alternative |
| Durability, recyclability | Shown as attributes; not used in the verdict |
| Toxicity, land use, biodiversity | **Not modelled** |

## 11. Comparison

The optimised product is the original specification with the selected operations applied in order. Both are assessed with the same boundary and factors and compared on a whole-batch basis. Interactions are captured: applying efficiency and renewable electricity together gives less than the sum of the two separate savings, because the model recalculates rather than adding percentages.

## 12. Limitations

1. Illustrative factors for everything except technology-specific electricity.
2. Electricity only; process heat and fuels are excluded.
3. Single transport leg; no inbound logistics; no use phase.
4. Material substitutions assume equal mass (packaging swaps use an assumed mass ratio).
5. Scrap carries its production burden but its treatment or recycling is not modelled.
6. Water is a volume, not a scarcity-weighted footprint.
7. Five indicators only.
8. Uncertainty covers factors, not the user's inputs or the model structure.
9. The per-unit functional unit ignores how many times a product is used. A reusable product looks worse per unit; the annualised figure is only a partial correction.

## 13. Future improvements

- Replace illustrative factors with ICE and DEFRA/DESNZ values.
- Country-specific grid factors.
- Process heat and fuel inputs.
- A use phase and a "per use" functional unit with reuse cycles.
- Scrap recycling loops.
- Monte Carlo uncertainty instead of the conservative linear combination.
- Additional indicators (water scarcity, toxicity, land use).
- Import of specifications from a bill of materials.

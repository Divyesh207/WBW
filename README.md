# Waste Before Waste

**Think Before You Manufacture.**
Pre-manufacturing environmental impact assessment and sustainable product optimization platform.

> Don't manage waste after it exists. Prevent it before it is manufactured.

Users describe a product *before* it is made. The platform estimates its environmental impact, identifies hotspots, recommends alternatives, and compares the original product with a recalculated, optimised one.

**SDG alignment:** SDG 12 (primary) · SDG 9 · SDG 13

> **Scientific status.** This is a *preliminary screening tool*. Every emission factor is an illustrative, rounded value; every impact figure is an estimate, not a measurement. It is **not** a certified ISO 14040/14044 Life Cycle Assessment.

---

## Quick start

Requirements: Python 3.11+ and Node.js 18+. No API keys, no paid services, no internet needed at runtime.

**1. Backend** (terminal 1)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

If `pip` fails with `CERTIFICATE_VERIFY_FAILED` (common behind antivirus or a proxy), use the system certificate store: `pip install --use-feature=truststore -r requirements.txt`.

**2. Frontend** (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The database is created and seeded with four demo assessments on first start.

| What | Where |
| --- | --- |
| Web application | http://localhost:5173 |
| Interactive API documentation | http://127.0.0.1:8000/docs |
| Run the unit tests | `cd backend && python -m pytest` |
| Production build | `cd frontend && npm run build` |

**Access:** there is no login. *Sign In* opens a demo workspace ("Demo User"); the name can be changed in Settings.

---

## Documentation

- [Environmental calculation methodology](docs/ENVIRONMENTAL_CALCULATION_METHODOLOGY.md) — every formula with worked examples, data sources, recommendation logic and limitations.
- [Technical audit report](docs/TECHNICAL_AUDIT_REPORT.md) — findings, corrections and remaining limitations.

## Features

- **Landing page** — a full-width 3D scroll story in the hero: a product blueprint becomes a real bottle, its footprint appears as a cloud of dots (one dot = 0.1 g CO2e, from the engine), and the cloud shrinks or grows when a different material is chosen. Followed by a schematic problem chart, an interactive five-step walkthrough, an original/optimised impact view, a material face-off, features, SDG alignment and call to action.
- **Dashboard** — products analysed, average footprint, avoidable carbon, resources saved, waste reduction; charts for impact by stage, material use, original vs. optimised, and assessment history. All values come from saved assessments.
- **New assessment** — five-step validated form (product, materials, manufacturing, packaging and end-of-life, review) with one-click demo scenarios.
- **Assessment engine** — carbon, energy, water, material consumption, manufacturing waste, transport, packaging and end-of-life, with an uncertainty range and a data-quality indicator.
- **Hotspots** — the stages, materials, energy intensity, scrap rate and water use that dominate the result.
- **Recommendations** — each with current situation, alternative, estimated benefit, cost, feasibility and trade-offs.
- **Comparison** — choose which recommendations to apply, recalculate, and compare side by side.
- **Reports** — on-screen/print report, professional PDF, JSON export.
- **Material explorer** — browse and compare the factor library.
- **Persistence** — every assessment is stored in SQLite.

## How the calculation works

```
materials      = Σ (material mass ÷ (1 − scrap rate)) × material factor
manufacturing  = electricity per unit × electricity factor
packaging      = packaging mass × packaging factor
transport      = (product + packaging mass) ÷ 1000 × distance × mode factor
end-of-life    = Σ mass × treatment factor (product and packaging)
total          = materials + manufacturing + packaging + transport + end-of-life
```

Safeguards built into the engine:

- **One boundary for every product**, so results are comparable. The use phase is excluded.
- **No double-counting.** Each flow is counted in one stage. Recycling gets no end-of-life credit (cut-off approach) because recycled content is already rewarded at the material stage. Process benchmarks are used only to flag unusual inputs, never added to the footprint.
- **Measured vs. estimated.** Results label what the user entered, what was calculated from it, and what was estimated from factors.
- **No false precision.** Values are rounded to three or four significant figures and shown with a range.
- **Recommendations are recalculated, not assumed.** Each one is a set of operations on the specification that is re-run through the same engine. A change that lowers carbon but raises another indicator is marked *mixed*; one that does not help is never pre-selected.
- **Every factor shows its assumed basis**, in the UI, the PDF and the JSON export.

### Replacing the factors

All coefficients live in `backend/app/data/*.json`. Each entry carries its value, uncertainty and basis. Swap these files for a licensed LCA database (keeping the same keys) and no calculation code needs to change.

---

## Project structure

```
WBW/
├── README.md
├── backend/
│   ├── requirements.txt
│   ├── .env.example
│   ├── app/
│   │   ├── main.py                     FastAPI app, startup seeding, error format
│   │   ├── api/routes.py               HTTP endpoints
│   │   ├── models/assessment.py        SQLAlchemy model
│   │   ├── schemas/product.py          Pydantic input schemas and validation
│   │   ├── services/
│   │   │   ├── factors.py              loads the JSON datasets
│   │   │   ├── assessment_engine.py    impact calculation, hotspots, data quality
│   │   │   ├── recommendation_engine.py
│   │   │   ├── comparison_engine.py    apply changes, recalculate, compare
│   │   │   ├── report_generator.py     PDF report
│   │   │   ├── assessment_service.py   orchestration, dashboard, seeding
│   │   │   └── demo_data.py            four demo scenarios
│   │   ├── data/                       material, energy, transportation,
│   │   │                               packaging and end-of-life factors
│   │   ├── database/                   SQLite engine (wbw.db is created here)
│   │   └── assets/fonts/               Sora and Inter for the PDF
│   ├── scripts/export_lab_snapshot.py  regenerates the landing page's offline data
│   └── tests/                          43 unit and API tests
└── frontend/
    ├── package.json, vite.config.ts, tailwind.config.js
    ├── public/assets/brand/            official logo files + usage notes
    └── src/
        ├── components/                 brand/BrandLogo, brand/BrandIcon, ui, charts, Toast
        ├── layouts/AppLayout.tsx       sidebar shell
        ├── pages/                      Landing, SignIn, Overview, NewAssessment, …
        ├── features/                   assessment (form, results, optimise), landing
        ├── services/api.ts             API client
        ├── hooks/, types/, utils/
```

## Brand

The official logo is stored once in `frontend/public/assets/brand/` and rendered only through `BrandLogo` (full lock-up) and `BrandIcon` (symbol). The components scale every dimension from one size value using the identity's ratios, so the logo cannot be stretched or re-proportioned. The PDF draws the same vector geometry. See `frontend/public/assets/brand/README.md`.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Service status |
| GET | `/api/reference` | Factor datasets and form options |
| GET | `/api/demo-scenarios` | Pre-configured demo specifications |
| GET | `/api/dashboard` | Aggregated dashboard figures |
| POST | `/api/assessments` | Run and save an assessment |
| POST | `/api/assessments/preview` | Calculate without saving |
| GET | `/api/assessments` | List saved assessments |
| GET / DELETE | `/api/assessments/{id}` | Read or delete one |
| POST | `/api/assessments/{id}/optimize` | Apply selected recommendations and recalculate |
| GET | `/api/assessments/{id}/report.pdf` | PDF report |
| GET | `/api/assessments/{id}/export.json` | JSON export |
| GET | `/api/lab` | Engine results for the landing-page material lab |
| POST | `/api/demo/reset` | Delete everything and restore demo data |

## Technology

React 18 · Vite · TypeScript · Tailwind CSS · Recharts · Framer Motion · Lucide · React Router · Three.js with React Three Fiber (landing page only, loaded on demand, with an SVG fallback when WebGL is unavailable)
Python · FastAPI · Pydantic · SQLAlchemy + SQLite · ReportLab · pytest

---

## Faculty demonstration (3–5 minutes)

1. **Landing page (45 s).** Scroll slowly: the blueprint becomes a bottle and its footprint appears as dots. At "Alternative", pick Recycled PET (the cloud thins by 45%), then Glass (it floods the screen: lower impact per kg, but eleven times the mass). Continue to problem → how it works.
2. **Dashboard (30 s).** Click *Sign In → Continue to dashboard*. Show the four products analysed and the original vs. optimised chart.
3. **New assessment (60 s).** *New Assessment* → *Load a demo scenario* → **Single-use plastic water bottle**. Step through the five steps; on Materials, change the quantity to show the weight check, then restore it. Click **Analyze Environmental Impact**.
4. **Results (45 s).** Show the footprint with its range, the stage breakdown (raw materials ≈ 72%), and the hotspots. Open *Assumptions & data quality* to show that every factor states its basis.
5. **Alternatives (60 s).** Open *Alternatives & comparison*. Expand the recycled PET recommendation to show cost, feasibility and trade-offs. Point out that *Switch packaging to recycled cardboard* is marked **Mixed** — it raises material use — so it is not pre-selected.
6. **Compare (30 s).** Tick or untick changes, click **Apply and recalculate**, and show the side-by-side table and charts (about −60% carbon with the four beneficial changes).
7. **Report (30 s).** *Full report* → **Download PDF**, and show the assumptions and data-quality section.

## Known limitations

- Factors are illustrative and generic, except technology-specific electricity factors (IPCC AR5 medians). Results are for learning and early screening, not for claims, labels or compliance.
- Manufacturing counts electricity only; process heat, fuels and factory overheads are excluded.
- Transport is a single leg; the use phase is not modelled.
- Material swaps assume the same mass. Real redesigns often change it.
- Indicators are limited to carbon, energy, water, material use and waste. Toxicity, land use and biodiversity are not covered.
- Uncertainty reflects factor uncertainty only, combined conservatively.
- Recommendations come from a fixed rule set, and the design-level ones (reuse, durability, repair) are advisory and not quantified.
- No authentication or multi-user separation: a single shared demo workspace.

## After changing factors or formulas

1. Bump `METHODOLOGY_VERSION` in `backend/app/services/assessment_engine.py` — saved assessments are then recalculated from their stored specification on the next start (nothing is deleted).
2. Run `python scripts/export_lab_snapshot.py` in `backend` so the landing page's offline data matches the engine (a test fails if it does not).

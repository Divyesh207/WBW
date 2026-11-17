"""Recommendation rules, comparison logic and the HTTP journey."""
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.product import ProductSpec
from app.services.assessment_engine import assess
from app.services.comparison_engine import apply_operations, compare, optimize
from app.services.demo_data import DEMO_SCENARIOS
from app.services.recommendation_engine import default_selection, recommend

REQUIRED_FIELDS = {
    "current_situation",
    "suggested_alternative",
    "estimated_benefit",
    "cost_implications",
    "feasibility",
    "trade_offs",
}


def by_id(recs):
    return {r["id"]: r for r in recs}


def test_bottle_gets_expected_recommendations(bottle):
    recs = by_id(recommend(bottle))
    assert "material:virgin_plastic:recycled_plastic" in recs
    assert "packaging:lightweight" in recs
    assert "energy:efficiency" in recs
    assert "energy:renewable" in recs
    assert recs["design:reusable"]["applicable"] is False


@pytest.mark.parametrize("scenario", DEMO_SCENARIOS, ids=lambda s: s["key"])
def test_every_recommendation_is_complete(scenario):
    spec = ProductSpec.model_validate(scenario["spec"])
    recs = recommend(spec)
    assert recs, "each demo product should trigger at least one recommendation"
    for rec in recs:
        assert REQUIRED_FIELDS <= rec.keys()
        assert all(rec[f] for f in REQUIRED_FIELDS), rec["id"]
        assert rec["verdict"] in {"beneficial", "mixed", "advisory", "not_beneficial"}
        if rec["applicable"]:
            assert rec["impact"] is not None and rec["operations"]


def test_benefit_is_recalculated_not_assumed(bottle):
    rec = by_id(recommend(bottle))["material:virgin_plastic:recycled_plastic"]
    swapped = ProductSpec.model_validate(apply_operations(bottle.model_dump(), rec["operations"]))
    a, b = assess(bottle)["batch"]["carbon_kg"], assess(swapped)["batch"]["carbon_kg"]
    assert rec["impact"]["carbon_pct"] == pytest.approx(100 * (b - a) / a, abs=0.1)


def test_alternative_that_does_not_help_is_not_preselected(bottle_dict):
    # With incineration, swapping film for board changes the end-of-life picture;
    # whatever the outcome, only "beneficial" verdicts may be pre-selected.
    for method in ("landfill", "incineration", "recycling"):
        bottle_dict["end_of_life"]["disposal_method"] = method
        recs = recommend(ProductSpec.model_validate(bottle_dict))
        chosen = set(default_selection(recs))
        for rec in recs:
            if rec["verdict"] != "beneficial":
                assert rec["id"] not in chosen


def test_trade_off_is_reported_when_another_indicator_worsens(bottle):
    rec = by_id(recommend(bottle))["packaging:conventional_plastic:recycled_cardboard"]
    assert rec["impact"]["material_pct"] > 0  # twice the packaging mass is assumed
    assert rec["verdict"] in {"mixed", "not_beneficial"}
    assert any("material consumption rising" in t for t in rec["trade_offs"])


def test_swap_material_merges_into_existing_row():
    spec = {"materials": [{"material_id": "a", "quantity_kg": 1.0}, {"material_id": "b", "quantity_kg": 2.0}]}
    out = apply_operations(spec, [{"op": "swap_material", "from": "a", "to": "b"}])
    assert out["materials"] == [{"material_id": "b", "quantity_kg": 3.0}]
    assert spec["materials"][0]["material_id"] == "a"  # input untouched


def test_optimize_with_no_selection_changes_nothing(bottle):
    out = optimize(bottle, recommend(bottle), [])
    assert out["comparison"]["summary"]["carbon_change_pct"] == 0
    assert all(m["direction"] == "unchanged" for m in out["comparison"]["metrics"])


def test_optimize_applies_only_selected(bottle):
    recs = recommend(bottle)
    out = optimize(bottle, recs, ["material:virgin_plastic:recycled_plastic", "design:reusable", "nonsense"])
    assert out["selected_ids"] == ["material:virgin_plastic:recycled_plastic"]
    assert out["optimized_spec"]["materials"][0]["material_id"] == "recycled_plastic"
    assert out["comparison"]["summary"]["carbon_change_pct"] < 0


def test_compare_flags_worsened_metrics(bottle, bottle_dict):
    bottle_dict["manufacturing"]["energy_kwh_per_unit"] = 0.07
    worse = assess(ProductSpec.model_validate(bottle_dict))
    cmp = compare(assess(bottle), worse)
    assert "Carbon footprint" in cmp["summary"]["worsened"]
    assert "Energy consumption" in cmp["summary"]["worsened"]


# ------------------------------------------------------------------ HTTP API
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_api_end_to_end(client, bottle_dict):
    assert client.get("/api/health").json()["status"] == "ok"
    assert len(client.get("/api/assessments").json()) == len(DEMO_SCENARIOS)  # seeded
    ref = client.get("/api/reference").json()
    assert len(ref["materials"]) == 14

    bottle_dict["name"] = "Test bottle"
    created = client.post("/api/assessments", json=bottle_dict)
    assert created.status_code == 201
    body = created.json()
    aid = body["id"]
    assert body["result"]["per_unit"]["carbon_kg"] > 0

    ids = [r["id"] for r in body["recommendations"] if r["applicable"]][:2]
    optimised = client.post(f"/api/assessments/{aid}/optimize", json={"recommendation_ids": ids}).json()
    assert optimised["selected_ids"] == ids
    assert client.get(f"/api/assessments/{aid}").json()["selected_ids"] == ids  # persisted

    pdf = client.get(f"/api/assessments/{aid}/report.pdf")
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    exported = client.get(f"/api/assessments/{aid}/export.json").json()
    assert exported["spec"]["name"] == "Test bottle"

    dash = client.get("/api/dashboard").json()
    assert dash["totals"]["products"] == len(DEMO_SCENARIOS) + 1

    assert client.delete(f"/api/assessments/{aid}").status_code == 204
    assert client.get(f"/api/assessments/{aid}").status_code == 404


def test_api_returns_readable_validation_errors(client, bottle_dict):
    bottle_dict["materials"][0]["quantity_kg"] = 1
    bottle_dict["production_quantity"] = 0
    res = client.post("/api/assessments", json=bottle_dict)
    assert res.status_code == 422
    fields = {e["field"] for e in res.json()["errors"]}
    assert "production_quantity" in fields


def test_api_rejects_unknown_ids(client, bottle_dict):
    bottle_dict["manufacturing"]["energy_source"] = "fusion"
    res = client.post("/api/assessments", json=bottle_dict)
    assert res.status_code == 422 and "Unknown energy source" in res.json()["detail"]

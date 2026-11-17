"""Checks added with the technical audit (methodology 1.1)."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.database import SessionLocal
from app.main import app
from app.models.assessment import Assessment
from app.schemas.product import ProductSpec
from app.services.assessment_engine import METHODOLOGY_VERSION, assess
from app.services.assessment_service import refresh_outdated
from app.services.factors import get_factors
from app.services.landing_lab import LAB_OPTIONS, build_lab, lab_spec
from app.services.recommendation_engine import MARGINAL_PCT, recommend

F = get_factors()


def test_every_factor_declares_published_or_illustrative():
    tables = [F.materials, F.energy_sources, F.transport_modes, F.packaging]
    for table in tables:
        for entry in table.values():
            assert entry["source_type"] in {"published", "illustrative"}
            if entry["source_type"] == "published":
                assert "IPCC" in entry["basis"], "a published factor must name its source"


def test_published_electricity_factors_match_ipcc_ar5_medians():
    expected = {"coal_grid": 0.82, "natural_gas": 0.49, "solar_pv": 0.041, "wind": 0.011, "hydro": 0.024}
    for key, value in expected.items():
        assert F.energy_source(key)["emission_factor"] == value
        assert F.energy_source(key)["source_type"] == "published"
    # No material factor may claim a published source it does not have.
    assert all(m["source_type"] == "illustrative" for m in F.materials.values())


def test_result_labels_factors_and_version(bottle):
    result = assess(bottle)
    assert result["methodology_version"] == METHODOLOGY_VERSION
    assert all(f["source_type"] in {"published", "illustrative"} for f in result["factors_used"])
    classes = {p["basis"] for p in result["provenance"]}
    assert classes == {"user-provided", "published factor", "illustrative assumption", "model estimate"}


def test_data_quality_is_capped_at_low_for_generic_data(bottle, bottle_dict):
    assert assess(bottle)["data_quality"]["score"] == 2
    assert assess(bottle)["data_quality"]["published_share_pct"] == 0
    bottle_dict["manufacturing"]["energy_source"] = "coal_grid"
    dq = assess(ProductSpec.model_validate(bottle_dict))["data_quality"]
    assert dq["score"] <= 2 and dq["published_share_pct"] > 0


def test_small_improvements_are_flagged_as_marginal(bottle):
    recs = {r["id"]: r for r in recommend(bottle)}
    light = recs["packaging:lightweight"]
    assert abs(light["impact"]["carbon_pct"]) < MARGINAL_PCT
    assert light["significance"] == "marginal"
    assert "factor uncertainty" in light["estimated_benefit"]
    assert recs["material:virgin_plastic:recycled_plastic"]["significance"] == "clear"
    assert recs["design:reusable"]["significance"] == "not_quantified"


def test_outdated_assessments_are_recalculated_not_deleted():
    with TestClient(app):
        with SessionLocal() as db:
            row = db.query(Assessment).first()
            row_id, spec, selected = row.id, dict(row.spec), list(row.selected_ids)
            stale = dict(row.result)
            stale["methodology_version"] = "0.9"
            stale["per_unit"] = {**stale["per_unit"], "carbon_kg": 999.0}
            row.result = stale
            db.commit()
            assert refresh_outdated(db) == 1
            fresh = db.get(Assessment, row_id)
            assert fresh.spec == spec and fresh.selected_ids == selected
            assert fresh.result["methodology_version"] == METHODOLOGY_VERSION
            assert fresh.result["per_unit"]["carbon_kg"] != 999.0
            assert refresh_outdated(db) == 0


def test_lab_values_come_from_the_engine():
    lab = build_lab()
    assert [o["id"] for o in lab["options"]] == [o["id"] for o in LAB_OPTIONS]
    for option, definition in zip(lab["options"], LAB_OPTIONS):
        direct = assess(lab_spec(definition, "grid_average"))["per_unit"]
        assert option["results"]["grid_average"]["carbon_kg"] == direct["carbon_kg"]
        assert option["results"]["renewable_mix"]["carbon_kg"] <= option["results"]["grid_average"]["carbon_kg"]
    by_id = {o["id"]: o["results"]["grid_average"]["carbon_kg"] for o in lab["options"]}
    assert by_id["recycled_pet"] < by_id["virgin_pet"]
    # Lower factor per kg, but far more mass: glass must not be shown as better per bottle.
    assert F.material("glass")["emission_factor"] < F.material("virgin_plastic")["emission_factor"]
    assert by_id["glass"] > by_id["virgin_pet"]


def test_lab_endpoint_and_snapshot_agree():
    with TestClient(app) as client:
        live = client.get("/api/lab").json()
    snapshot = Path(__file__).resolve().parents[2] / "frontend" / "src" / "features" / "landing" / "labSnapshot.json"
    if not snapshot.exists():
        pytest.skip("snapshot not exported yet")
    assert json.loads(snapshot.read_text(encoding="utf-8")) == live, "run scripts/export_lab_snapshot.py"

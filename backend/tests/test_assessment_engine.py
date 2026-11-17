"""Calculation logic: every stage is checked against a hand calculation."""
import pytest
from pydantic import ValidationError

from app.schemas.product import ProductSpec
from app.services.assessment_engine import assess, sig
from app.services.factors import UnknownFactorError, get_factors

F = get_factors()


def stage(result, key):
    return next(s for s in result["stages"] if s["key"] == key)


def test_sig_rounds_to_significant_figures():
    assert sig(123456, 3) == 123000
    assert sig(0.0123456, 3) == 0.0123
    assert sig(0) == 0


def test_material_stage_uses_gross_input(bottle):
    result = assess(bottle)
    ef = F.material("virgin_plastic")["emission_factor"]
    expected = 0.025 / (1 - 0.03) * ef
    assert stage(result, "materials")["carbon_kg"] == pytest.approx(expected, rel=1e-3)


def test_manufacturing_stage_is_energy_times_grid_factor(bottle):
    result = assess(bottle)
    expected = 0.035 * F.energy_source("grid_average")["emission_factor"]
    assert stage(result, "manufacturing")["carbon_kg"] == pytest.approx(expected, rel=1e-3)


def test_transport_stage_uses_product_plus_packaging_mass(bottle):
    result = assess(bottle)
    expected = (0.025 + 0.004) / 1000 * 400 * F.transport_mode("road")["emission_factor"]
    assert stage(result, "transport")["carbon_kg"] == pytest.approx(expected, rel=1e-3)


def test_packaging_stage(bottle):
    result = assess(bottle)
    expected = 0.004 * F.packaging_option("conventional_plastic")["emission_factor"]
    assert stage(result, "packaging")["carbon_kg"] == pytest.approx(expected, rel=1e-3)


def test_end_of_life_covers_product_and_packaging_once(bottle):
    result = assess(bottle)
    expected = (0.025 + 0.004) * F.eol_factor("polymer", "landfill")
    assert stage(result, "end_of_life")["carbon_kg"] == pytest.approx(expected, rel=1e-3)


def test_total_is_sum_of_stages_no_double_counting(bottle):
    result = assess(bottle)
    total = sum(s["carbon_kg"] for s in result["stages"])
    assert result["per_unit"]["carbon_kg"] == pytest.approx(total, rel=1e-3)
    assert sum(s["share_pct"] for s in result["stages"]) == pytest.approx(100, abs=0.3)


def test_batch_scales_with_quantity(bottle, bottle_dict):
    bottle_dict["production_quantity"] = 20000
    double = assess(ProductSpec.model_validate(bottle_dict))
    single = assess(bottle)
    assert double["batch"]["carbon_kg"] == pytest.approx(2 * single["batch"]["carbon_kg"], rel=1e-3)
    assert double["per_unit"]["carbon_kg"] == single["per_unit"]["carbon_kg"]


def test_waste_mass_and_gross_input(bottle):
    result = assess(bottle)
    gross = 0.025 / 0.97
    assert result["per_unit"]["material_input_kg"] == pytest.approx(gross, rel=1e-3)
    assert result["per_unit"]["waste_kg"] == pytest.approx(gross - 0.025, rel=1e-3)


def test_energy_and_water_split_process_and_embodied(bottle):
    pu = assess(bottle)["per_unit"]
    assert pu["process_energy_kwh"] == 0.035
    assert pu["energy_kwh"] == pytest.approx(pu["process_energy_kwh"] + pu["embodied_energy_kwh"], rel=1e-3)
    assert pu["water_l"] == pytest.approx(pu["process_water_l"] + pu["embodied_water_l"], rel=1e-3)


def test_recycling_gets_no_credit_cut_off(bottle, bottle_dict):
    bottle_dict["end_of_life"]["disposal_method"] = "recycling"
    recycled = assess(ProductSpec.model_validate(bottle_dict))
    assert stage(recycled, "end_of_life")["carbon_kg"] >= 0
    assert stage(recycled, "materials")["carbon_kg"] == stage(assess(bottle), "materials")["carbon_kg"]


def test_incinerating_plastic_is_worse_than_landfill_for_carbon(bottle, bottle_dict):
    bottle_dict["end_of_life"]["disposal_method"] = "incineration"
    burned = assess(ProductSpec.model_validate(bottle_dict))
    assert stage(burned, "end_of_life")["carbon_kg"] > stage(assess(bottle), "end_of_life")["carbon_kg"]


def test_composting_non_compostable_material_warns(bottle_dict):
    bottle_dict["end_of_life"]["disposal_method"] = "composting"
    result = assess(ProductSpec.model_validate(bottle_dict))
    assert any("not compostable" in w for w in result["warnings"])


def test_uncertainty_range_brackets_estimate(bottle):
    pu = assess(bottle)["per_unit"]
    assert pu["carbon_low_kg"] < pu["carbon_kg"] < pu["carbon_high_kg"]


def test_data_quality_never_claims_high_confidence(bottle):
    dq = assess(bottle)["data_quality"]
    assert dq["score"] <= 3 and dq["max_score"] == 5
    assert dq["uncertainty_pct"] > 0


def test_hotspots_identify_materials_for_bottle(bottle):
    hotspots = assess(bottle)["hotspots"]
    assert hotspots[0]["id"] == "stage-materials"
    assert hotspots[0]["severity"] == "high"
    assert any(h["id"] == "energy-intensity" for h in hotspots)


def test_result_is_labelled_as_screening(bottle):
    result = assess(bottle)
    assert "not a certified" in result["disclaimer"]
    assert all(s["basis"] == "estimated" for s in result["stages"])


def test_materials_must_match_product_weight(bottle_dict):
    bottle_dict["materials"][0]["quantity_kg"] = 0.05
    with pytest.raises(ValidationError, match="must match within 5%"):
        ProductSpec.model_validate(bottle_dict)


def test_duplicate_materials_rejected(bottle_dict):
    bottle_dict["materials"] = [
        {"material_id": "virgin_plastic", "quantity_kg": 0.0125},
        {"material_id": "virgin_plastic", "quantity_kg": 0.0125},
    ]
    with pytest.raises(ValidationError, match="only be listed once"):
        ProductSpec.model_validate(bottle_dict)


def test_unknown_material_raises(bottle_dict):
    bottle_dict["materials"][0]["material_id"] = "unobtainium"
    with pytest.raises(UnknownFactorError):
        assess(ProductSpec.model_validate(bottle_dict))

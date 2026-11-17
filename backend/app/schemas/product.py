"""Input schemas: the product specification a user submits before manufacturing."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

CATEGORIES = [
    "Packaging",
    "Electronics",
    "Furniture",
    "Textiles",
    "Construction materials",
    "Consumer goods",
    "Other",
]

# Sum of material quantities must match the declared product weight within this tolerance.
WEIGHT_TOLERANCE = 0.05


class MaterialInput(BaseModel):
    material_id: str
    quantity_kg: float = Field(gt=0, description="Mass of this material in ONE finished unit (kg).")


class ManufacturingInput(BaseModel):
    method: str
    energy_kwh_per_unit: float = Field(ge=0, le=100000)
    energy_source: str
    water_l_per_unit: float = Field(ge=0, le=10000000)
    waste_pct: float = Field(ge=0, le=90, description="Share of input material lost as scrap (%).")
    transport_distance_km: float = Field(ge=0, le=50000)
    transport_mode: str


class PackagingInput(BaseModel):
    material: str
    weight_kg: float = Field(ge=0, le=10000, description="Packaging mass per unit (kg).")


class EndOfLifeInput(BaseModel):
    recyclability: Literal["high", "medium", "low", "none"]
    disposal_method: Literal["recycling", "landfill", "incineration", "composting"]
    use_type: Literal["reusable", "single_use"]
    repairability: Literal["high", "medium", "low", "not_applicable"]


class ProductSpec(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    category: str
    description: str = Field(default="", max_length=1000)
    production_quantity: int = Field(ge=1, le=100_000_000)
    product_weight_kg: float = Field(gt=0, le=100000)
    lifespan_years: float = Field(gt=0, le=200)
    materials: list[MaterialInput] = Field(min_length=1, max_length=20)
    manufacturing: ManufacturingInput
    packaging: PackagingInput
    end_of_life: EndOfLifeInput

    @field_validator("name")
    @classmethod
    def _strip_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Product name must be at least 2 characters.")
        return v

    @field_validator("category")
    @classmethod
    def _known_category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"Unknown category '{v}'. Choose one of: {', '.join(CATEGORIES)}.")
        return v

    @model_validator(mode="after")
    def _check_materials(self) -> "ProductSpec":
        ids = [m.material_id for m in self.materials]
        if len(ids) != len(set(ids)):
            raise ValueError("Each material can only be listed once. Combine duplicate rows.")
        total = sum(m.quantity_kg for m in self.materials)
        if abs(total - self.product_weight_kg) > WEIGHT_TOLERANCE * self.product_weight_kg:
            raise ValueError(
                f"Materials add up to {total:.4g} kg but the product weight is "
                f"{self.product_weight_kg:.4g} kg. They must match within 5%."
            )
        if self.packaging.material == "none" and self.packaging.weight_kg > 0:
            raise ValueError("Packaging weight must be 0 when 'No packaging' is selected.")
        return self


class OptimizeRequest(BaseModel):
    recommendation_ids: list[str] = Field(default_factory=list)

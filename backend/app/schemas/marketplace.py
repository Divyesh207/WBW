"""Request bodies for authentication and the Supplier Marketplace."""
from __future__ import annotations

import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

Category = Literal["recycled", "waste_based", "bio_based", "low_impact_virgin"]
Grade = Literal["A", "B", "C"]
SupplierType = Literal["recycler", "waste_producer", "material_supplier"]


def _clean_email(value: str) -> str:
    value = value.strip().lower()
    if not EMAIL_RE.match(value):
        raise ValueError("Enter a valid email address.")
    return value


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(max_length=160)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["manufacturer", "supplier"]
    organisation: str = Field(default="", max_length=160)
    # Supplier-only fields (required when role == supplier)
    company_name: str = Field(default="", max_length=160)
    city: str = Field(default="", max_length=80)
    state: str = Field(default="", max_length=80)
    supplier_type: SupplierType = "recycler"

    _email = field_validator("email")(lambda cls, v: _clean_email(v))

    @field_validator("name", "organisation", "company_name", "city", "state")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v) or not re.search(r"\d", v):
            raise ValueError("Password must contain at least one letter and one number.")
        return v

    @model_validator(mode="after")
    def _supplier_fields(self) -> "RegisterRequest":
        if self.role == "supplier" and len(self.company_name) < 2:
            raise ValueError("Suppliers must give a company name.")
        return self


class LoginRequest(BaseModel):
    email: str
    password: str = Field(min_length=1, max_length=128)

    _email = field_validator("email")(lambda cls, v: v.strip().lower())


class SupplierProfileUpdate(BaseModel):
    company_name: str = Field(min_length=2, max_length=160)
    description: str = Field(default="", max_length=2000)
    city: str = Field(default="", max_length=80)
    state: str = Field(default="", max_length=80)
    contact_email: str = Field(default="", max_length=160)
    phone: str = Field(default="", max_length=40)
    website: str = Field(default="", max_length=200)
    certifications: list[str] = Field(default_factory=list, max_length=10)
    supplier_type: SupplierType = "recycler"

    @field_validator("contact_email")
    @classmethod
    def _contact(cls, v: str) -> str:
        return _clean_email(v) if v.strip() else ""

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        v = v.strip()
        if v and not re.fullmatch(r"[+\d][\d\s\-()]{6,38}", v):
            raise ValueError("Enter a valid phone number.")
        return v

    @field_validator("certifications")
    @classmethod
    def _certs(cls, v: list[str]) -> list[str]:
        return [c.strip()[:80] for c in v if c.strip()]


class ListingInput(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    material_id: str | None = Field(default=None, max_length=60)
    category: Category
    form: str = Field(default="", max_length=60)
    description: str = Field(default="", max_length=2000)
    price_per_kg: float = Field(gt=0, le=1_000_000)
    quality_grade: Grade
    recycled_content_pct: float = Field(ge=0, le=100)
    available_kg: float = Field(ge=0, le=100_000_000)
    min_order_kg: float = Field(gt=0, le=10_000_000)
    lead_time_days: int = Field(ge=0, le=365)
    location: str = Field(default="", max_length=120)
    is_active: bool = True

    @field_validator("title", "form", "location")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()

    @field_validator("material_id")
    @classmethod
    def _material(cls, v: str | None) -> str | None:
        return v or None


class MaterialRequestInput(BaseModel):
    listing_id: int
    quantity_kg: float = Field(gt=0, le=100_000_000)
    target_price_per_kg: float | None = Field(default=None, gt=0, le=1_000_000)
    required_by: date | None = None
    message: str = Field(default="", max_length=2000)
    assessment_id: int | None = None

    @field_validator("required_by")
    @classmethod
    def _future(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("The required-by date cannot be in the past.")
        return v


class RequestResponse(BaseModel):
    """Supplier's answer to a request."""

    action: Literal["accept", "quote", "reject"]
    message: str = Field(default="", max_length=2000)
    quoted_price_per_kg: float | None = Field(default=None, gt=0, le=1_000_000)

    @model_validator(mode="after")
    def _check(self) -> "RequestResponse":
        if self.action == "quote" and self.quoted_price_per_kg is None:
            raise ValueError("Give a price per kg when sending a quote.")
        if self.action == "reject" and len(self.message.strip()) < 3:
            raise ValueError("Give a short reason when rejecting a request.")
        return self


class PlaceOrderInput(BaseModel):
    delivery_address: str = Field(min_length=5, max_length=500)


class OrderStatusUpdate(BaseModel):
    status: Literal["confirmed", "dispatched", "delivered", "cancelled"]
    note: str = Field(default="", max_length=1000)


class RepeatRequestInput(BaseModel):
    """Re-send a previous request or order. Quantity can be changed; defaults to the original."""

    quantity_kg: float | None = Field(default=None, gt=0, le=100_000_000)
    message: str = Field(default="", max_length=2000)

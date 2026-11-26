"""Supplier Marketplace tables.

    users ──< auth_tokens
      │
      ├── supplier_profiles (1:1, suppliers only) ──< listings
      │
      └──< material_requests >── listings
               │ (accepted)
               └── orders ──< order_events

A material request is a manufacturer's enquiry about one listing. When the
supplier accepts it (or quotes a price the manufacturer accepts), an order is
placed. Orders move through a fixed status sequence; each change is recorded in
order_events, which is the tracking history. Repeat requests point back to the
request or order they were copied from.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


def iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).isoformat() if value.tzinfo is None else value.isoformat()


ROLES = ("manufacturer", "supplier")
LISTING_CATEGORIES = ("recycled", "waste_based", "bio_based", "low_impact_virgin")
QUALITY_GRADES = ("A", "B", "C")
REQUEST_STATUSES = ("pending", "quoted", "accepted", "rejected", "cancelled", "ordered")
ORDER_STATUSES = ("placed", "confirmed", "dispatched", "delivered", "cancelled")


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    organisation: Mapped[str] = mapped_column(String(160), default="")
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(200))
    is_demo: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    supplier_profile: Mapped["SupplierProfile | None"] = relationship(back_populates="user", uselist=False)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "organisation": self.organisation,
            "role": self.role,
            "is_demo": self.is_demo,
            "supplier_id": self.supplier_profile.id if self.supplier_profile else None,
            "created_at": iso(self.created_at),
        }


class AuthToken(Base):
    """Revocation list: signed-out tokens (by hash) until they expire. Valid tokens are not stored."""

    __tablename__ = "auth_tokens"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


class SupplierProfile(Base):
    __tablename__ = "supplier_profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    company_name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    city: Mapped[str] = mapped_column(String(80), default="")
    state: Mapped[str] = mapped_column(String(80), default="")
    contact_email: Mapped[str] = mapped_column(String(160), default="")
    phone: Mapped[str] = mapped_column(String(40), default="")
    website: Mapped[str] = mapped_column(String(200), default="")
    certifications: Mapped[list] = mapped_column(JSON, default=list)
    supplier_type: Mapped[str] = mapped_column(String(40), default="recycler")  # recycler | waste_producer | material_supplier
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    user: Mapped[User] = relationship(back_populates="supplier_profile")
    listings: Mapped[list["Listing"]] = relationship(back_populates="supplier")

    def to_dict(self, *, with_stats: bool = False) -> dict:
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "company_name": self.company_name,
            "description": self.description,
            "city": self.city,
            "state": self.state,
            "contact_email": self.contact_email,
            "phone": self.phone,
            "website": self.website,
            "certifications": self.certifications or [],
            "supplier_type": self.supplier_type,
            "is_demo": self.user.is_demo if self.user else False,
            "created_at": iso(self.created_at),
        }
        if with_stats:
            data["active_listings"] = sum(1 for listing in self.listings if listing.is_active)
        return data


class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier_profiles.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(160))
    # Optional link to the environmental factor library, so a listing can be matched to recommendations.
    material_id: Mapped[str | None] = mapped_column(String(60), nullable=True, index=True)
    category: Mapped[str] = mapped_column(String(30))
    form: Mapped[str] = mapped_column(String(60), default="")  # e.g. flakes, pellets, sheets, bales
    description: Mapped[str] = mapped_column(Text, default="")
    price_per_kg: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    quality_grade: Mapped[str] = mapped_column(String(1))
    recycled_content_pct: Mapped[float] = mapped_column(Float, default=0)
    available_kg: Mapped[float] = mapped_column(Float)
    min_order_kg: Mapped[float] = mapped_column(Float, default=1)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=7)
    location: Mapped[str] = mapped_column(String(120), default="")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    supplier: Mapped[SupplierProfile] = relationship(back_populates="listings")

    @property
    def availability(self) -> str:
        if not self.is_active or self.available_kg <= 0:
            return "out_of_stock"
        if self.available_kg < self.min_order_kg * 5:
            return "limited"
        return "in_stock"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.company_name if self.supplier else "",
            "supplier_city": self.supplier.city if self.supplier else "",
            "supplier_is_demo": bool(self.supplier and self.supplier.user and self.supplier.user.is_demo),
            "title": self.title,
            "material_id": self.material_id,
            "category": self.category,
            "form": self.form,
            "description": self.description,
            "price_per_kg": self.price_per_kg,
            "currency": self.currency,
            "quality_grade": self.quality_grade,
            "recycled_content_pct": self.recycled_content_pct,
            "available_kg": self.available_kg,
            "min_order_kg": self.min_order_kg,
            "lead_time_days": self.lead_time_days,
            "location": self.location,
            "availability": self.availability,
            "is_active": self.is_active,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }


class MaterialRequest(Base):
    __tablename__ = "material_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier_profiles.id"), index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    quantity_kg: Mapped[float] = mapped_column(Float)
    target_price_per_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    required_by: Mapped[str | None] = mapped_column(String(10), nullable=True)  # ISO date
    message: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="pending")
    quoted_price_per_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    supplier_response: Mapped[str] = mapped_column(Text, default="")
    repeat_of_request_id: Mapped[int | None] = mapped_column(ForeignKey("material_requests.id"), nullable=True)
    repeat_of_order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id", use_alter=True), nullable=True)
    assessment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)
    responded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    listing: Mapped[Listing] = relationship()
    supplier: Mapped[SupplierProfile] = relationship()
    manufacturer: Mapped[User] = relationship()
    order: Mapped["Order | None"] = relationship(back_populates="request", uselist=False, foreign_keys="Order.request_id")

    @property
    def agreed_price(self) -> float:
        return self.quoted_price_per_kg if self.quoted_price_per_kg is not None else self.listing.price_per_kg

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "manufacturer_id": self.manufacturer_id,
            "manufacturer_name": self.manufacturer.name if self.manufacturer else "",
            "manufacturer_organisation": self.manufacturer.organisation if self.manufacturer else "",
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.company_name if self.supplier else "",
            "listing_id": self.listing_id,
            "listing_title": self.listing.title if self.listing else "",
            "listing_price_per_kg": self.listing.price_per_kg if self.listing else None,
            "currency": self.listing.currency if self.listing else "INR",
            "quantity_kg": self.quantity_kg,
            "target_price_per_kg": self.target_price_per_kg,
            "required_by": self.required_by,
            "message": self.message,
            "status": self.status,
            "quoted_price_per_kg": self.quoted_price_per_kg,
            "agreed_price_per_kg": self.agreed_price if self.listing else None,
            "estimated_total": round(self.agreed_price * self.quantity_kg, 2) if self.listing else None,
            "supplier_response": self.supplier_response,
            "repeat_of_request_id": self.repeat_of_request_id,
            "repeat_of_order_id": self.repeat_of_order_id,
            "assessment_id": self.assessment_id,
            "order_id": self.order.id if self.order else None,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
            "responded_at": iso(self.responded_at),
        }


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("material_requests.id"), unique=True)
    manufacturer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("supplier_profiles.id"), index=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"))
    quantity_kg: Mapped[float] = mapped_column(Float)
    price_per_kg: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(3), default="INR")
    total_amount: Mapped[float] = mapped_column(Float)
    delivery_address: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="placed")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    request: Mapped[MaterialRequest] = relationship(back_populates="order", foreign_keys=[request_id])
    listing: Mapped[Listing] = relationship()
    supplier: Mapped[SupplierProfile] = relationship()
    manufacturer: Mapped[User] = relationship()
    events: Mapped[list["OrderEvent"]] = relationship(back_populates="order", order_by="OrderEvent.id", cascade="all, delete-orphan")

    def to_dict(self, *, with_events: bool = False) -> dict:
        data = {
            "id": self.id,
            "request_id": self.request_id,
            "manufacturer_id": self.manufacturer_id,
            "manufacturer_name": self.manufacturer.name if self.manufacturer else "",
            "manufacturer_organisation": self.manufacturer.organisation if self.manufacturer else "",
            "supplier_id": self.supplier_id,
            "supplier_name": self.supplier.company_name if self.supplier else "",
            "listing_id": self.listing_id,
            "listing_title": self.listing.title if self.listing else "",
            "material_id": self.listing.material_id if self.listing else None,
            "quantity_kg": self.quantity_kg,
            "price_per_kg": self.price_per_kg,
            "currency": self.currency,
            "total_amount": self.total_amount,
            "delivery_address": self.delivery_address,
            "status": self.status,
            "created_at": iso(self.created_at),
            "updated_at": iso(self.updated_at),
        }
        if with_events:
            data["events"] = [e.to_dict() for e in self.events]
        return data


class OrderEvent(Base):
    __tablename__ = "order_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text, default="")
    actor_role: Mapped[str] = mapped_column(String(20))
    actor_name: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    order: Mapped[Order] = relationship(back_populates="events")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "status": self.status,
            "note": self.note,
            "actor_role": self.actor_role,
            "actor_name": self.actor_name,
            "created_at": iso(self.created_at),
        }

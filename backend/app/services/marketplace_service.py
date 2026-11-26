"""Business rules of the Supplier Marketplace.

Request lifecycle
    pending ──accept──> accepted ──place order──> ordered
       │  └──quote───> quoted ────place order──> ordered
       ├──reject──> rejected
       └──cancel (manufacturer, any open state)──> cancelled

Order lifecycle (each change is written to order_events)
    placed ─> confirmed ─> dispatched ─> delivered
       └──────────┴──> cancelled   (stock is returned to the listing)

Repeat request: copies a previous request or order into a new pending request.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.assessment import Assessment
from app.models.marketplace import (
    LISTING_CATEGORIES,
    Listing,
    MaterialRequest,
    Order,
    OrderEvent,
    SupplierProfile,
    User,
)
from app.schemas.marketplace import (
    ListingInput,
    MaterialRequestInput,
    OrderStatusUpdate,
    PlaceOrderInput,
    RepeatRequestInput,
    RequestResponse,
    SupplierProfileUpdate,
)
from app.services.factors import get_factors

GRADE_RANK = {"A": 3, "B": 2, "C": 1}
OPEN_REQUEST = ("pending", "quoted", "accepted")
OPEN_ORDER = ("placed", "confirmed", "dispatched")

# Who may move an order from one status to the next.
TRANSITIONS: dict[tuple[str, str], set[str]] = {
    ("placed", "confirmed"): {"supplier"},
    ("confirmed", "dispatched"): {"supplier"},
    ("dispatched", "delivered"): {"supplier", "manufacturer"},
    ("placed", "cancelled"): {"supplier", "manufacturer"},
    ("confirmed", "cancelled"): {"supplier"},
}

CATEGORY_LABELS = {
    "recycled": "Recycled",
    "waste_based": "Waste-based / by-product",
    "bio_based": "Bio-based / renewable",
    "low_impact_virgin": "Low-impact virgin",
}
SUPPLIER_TYPE_LABELS = {
    "recycler": "Recycler",
    "waste_producer": "Waste producer (industrial by-products)",
    "material_supplier": "Sustainable material supplier",
}


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _not_found(what: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{what} not found.")


# ---------------------------------------------------------------- reference
def meta() -> dict:
    factors = get_factors()
    return {
        "categories": CATEGORY_LABELS,
        "quality_grades": {"A": "Grade A (premium / food-contact capable)", "B": "Grade B (standard industrial)", "C": "Grade C (mixed / non-critical uses)"},
        "supplier_types": SUPPLIER_TYPE_LABELS,
        "order_statuses": ["placed", "confirmed", "dispatched", "delivered", "cancelled"],
        "currency": "INR",
        "materials": [{"id": m["id"], "name": m["name"], "family": factors.families[m["family"]]} for m in factors.raw_materials["materials"]],
    }


def _library(material_id: str | None) -> dict | None:
    """Illustrative environmental factor for a listing linked to the factor library."""
    if not material_id:
        return None
    material = get_factors().materials.get(material_id)
    if not material:
        return None
    return {
        "material_id": material_id,
        "name": material["name"],
        "emission_factor": material["emission_factor"],
        "embodied_energy": material["embodied_energy"],
        "water": material["water"],
        "source_type": material.get("source_type", "illustrative"),
    }


def listing_view(listing: Listing) -> dict:
    data = listing.to_dict()
    data["library"] = _library(listing.material_id)
    return data


# ---------------------------------------------------------------- suppliers
def update_profile(db: Session, profile: SupplierProfile, body: SupplierProfileUpdate) -> SupplierProfile:
    for key, value in body.model_dump().items():
        setattr(profile, key, value)
    profile.user.organisation = body.company_name
    db.commit()
    return profile


def list_suppliers(db: Session) -> list[dict]:
    rows = db.scalars(select(SupplierProfile).order_by(SupplierProfile.company_name)).all()
    return [r.to_dict(with_stats=True) for r in rows]


def supplier_public(db: Session, supplier_id: int) -> dict:
    profile = db.get(SupplierProfile, supplier_id)
    if profile is None:
        raise _not_found("Supplier")
    data = profile.to_dict(with_stats=True)
    data["listings"] = [listing_view(item) for item in profile.listings if item.is_active]
    data["completed_orders"] = db.scalar(select(func.count(Order.id)).where(Order.supplier_id == supplier_id, Order.status == "delivered")) or 0
    return data


# ---------------------------------------------------------------- listings
def _check_material(material_id: str | None) -> None:
    if material_id and material_id not in get_factors().materials:
        raise HTTPException(status_code=422, detail=f"Unknown library material '{material_id}'.")


def search_listings(
    db: Session,
    *,
    q: str = "",
    category: str = "",
    material_id: str = "",
    min_grade: str = "",
    location: str = "",
    max_price: float | None = None,
    in_stock: bool = False,
    sort: str = "relevance",
) -> list[dict]:
    query = select(Listing).join(SupplierProfile).where(Listing.is_active.is_(True))
    if q.strip():
        like = f"%{q.strip().lower()}%"
        query = query.where(
            or_(func.lower(Listing.title).like(like), func.lower(Listing.description).like(like), func.lower(SupplierProfile.company_name).like(like), func.lower(Listing.form).like(like))
        )
    if category:
        if category not in LISTING_CATEGORIES:
            raise HTTPException(status_code=422, detail="Unknown category.")
        query = query.where(Listing.category == category)
    if material_id:
        query = query.where(Listing.material_id == material_id)
    if min_grade in GRADE_RANK:
        query = query.where(Listing.quality_grade.in_([g for g, r in GRADE_RANK.items() if r >= GRADE_RANK[min_grade]]))
    if location.strip():
        like = f"%{location.strip().lower()}%"
        query = query.where(or_(func.lower(Listing.location).like(like), func.lower(SupplierProfile.city).like(like), func.lower(SupplierProfile.state).like(like)))
    if max_price is not None:
        query = query.where(Listing.price_per_kg <= max_price)
    if in_stock:
        query = query.where(Listing.available_kg > 0)
    rows = db.scalars(query).all()

    sorters = {
        "price_asc": lambda x: (x.price_per_kg, -GRADE_RANK[x.quality_grade]),
        "price_desc": lambda x: (-x.price_per_kg,),
        "quality": lambda x: (-GRADE_RANK[x.quality_grade], x.price_per_kg),
        "availability": lambda x: (-x.available_kg,),
        "recycled": lambda x: (-x.recycled_content_pct, x.price_per_kg),
        "lead_time": lambda x: (x.lead_time_days, x.price_per_kg),
        "newest": lambda x: (-(x.created_at.timestamp() if x.created_at else 0),),
        "relevance": lambda x: ({"in_stock": 0, "limited": 1, "out_of_stock": 2}[x.availability], -GRADE_RANK[x.quality_grade], x.price_per_kg),
    }
    rows = sorted(rows, key=sorters.get(sort, sorters["relevance"]))
    return [listing_view(r) for r in rows]


def get_listing(db: Session, listing_id: int, *, include_inactive: bool = False) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or (not listing.is_active and not include_inactive):
        raise _not_found("Listing")
    return listing


def compare_listings(db: Session, ids: list[int], quantity_kg: float | None) -> dict:
    if not 2 <= len(ids) <= 4:
        raise HTTPException(status_code=422, detail="Select between 2 and 4 listings to compare.")
    listings = [get_listing(db, i, include_inactive=True) for i in dict.fromkeys(ids)]
    rows = []
    for item in listings:
        view = listing_view(item)
        if quantity_kg:
            issues = []
            if quantity_kg < item.min_order_kg:
                issues.append(f"Below the minimum order of {item.min_order_kg:g} kg")
            if quantity_kg > item.available_kg:
                issues.append(f"Only {item.available_kg:g} kg available")
            if not item.is_active:
                issues.append("Listing is no longer active")
            view["quantity_check"] = {
                "quantity_kg": quantity_kg,
                "total_cost": round(item.price_per_kg * quantity_kg, 2),
                "can_supply": not issues,
                "issues": issues,
            }
        rows.append(view)

    def best(key, reverse=False, eligible=None):
        pool = [r for r in rows if eligible is None or eligible(r)]
        if not pool:
            return None
        return (max if reverse else min)(pool, key=key)["id"]

    return {
        "quantity_kg": quantity_kg,
        "listings": rows,
        "best": {
            "lowest_price": best(lambda r: r["price_per_kg"]),
            "highest_quality": best(lambda r: GRADE_RANK[r["quality_grade"]], reverse=True),
            "most_available": best(lambda r: r["available_kg"], reverse=True),
            "highest_recycled_content": best(lambda r: r["recycled_content_pct"], reverse=True),
            "shortest_lead_time": best(lambda r: r["lead_time_days"]),
            "lowest_illustrative_carbon": best(lambda r: r["library"]["emission_factor"], eligible=lambda r: r["library"] is not None),
        },
        "note": "Prices, grades and stock are set by each supplier. Carbon figures are the platform's illustrative library factors per kg, not supplier-verified data.",
    }


def create_listing(db: Session, profile: SupplierProfile, body: ListingInput) -> Listing:
    _check_material(body.material_id)
    listing = Listing(supplier_id=profile.id, **body.model_dump())
    if not listing.location:
        listing.location = ", ".join(p for p in (profile.city, profile.state) if p)
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def _own_listing(db: Session, profile: SupplierProfile, listing_id: int) -> Listing:
    listing = db.get(Listing, listing_id)
    if listing is None or listing.supplier_id != profile.id:
        raise _not_found("Listing")
    return listing


def update_listing(db: Session, profile: SupplierProfile, listing_id: int, body: ListingInput) -> Listing:
    _check_material(body.material_id)
    listing = _own_listing(db, profile, listing_id)
    for key, value in body.model_dump().items():
        setattr(listing, key, value)
    db.commit()
    return listing


def delete_listing(db: Session, profile: SupplierProfile, listing_id: int) -> str:
    """Listings with request history are archived, not deleted, so past orders stay intact."""
    listing = _own_listing(db, profile, listing_id)
    used = db.scalar(select(func.count(MaterialRequest.id)).where(MaterialRequest.listing_id == listing.id))
    if used:
        listing.is_active = False
        db.commit()
        return "archived"
    db.delete(listing)
    db.commit()
    return "deleted"


# ---------------------------------------------------------------- requests
def _validate_quantity(listing: Listing, quantity: float) -> None:
    if not listing.is_active:
        raise HTTPException(status_code=409, detail="This listing is no longer available.")
    if quantity < listing.min_order_kg:
        raise HTTPException(status_code=422, detail=f"The minimum order for this listing is {listing.min_order_kg:g} kg.")
    if quantity > listing.available_kg:
        raise HTTPException(status_code=422, detail=f"Only {listing.available_kg:g} kg is currently available from this supplier.")


def create_request(db: Session, manufacturer: User, body: MaterialRequestInput, *, repeat_of_request: int | None = None, repeat_of_order: int | None = None) -> MaterialRequest:
    listing = get_listing(db, body.listing_id, include_inactive=True)
    _validate_quantity(listing, body.quantity_kg)
    duplicate = db.scalar(
        select(MaterialRequest.id).where(
            MaterialRequest.manufacturer_id == manufacturer.id,
            MaterialRequest.listing_id == listing.id,
            MaterialRequest.status.in_(OPEN_REQUEST),
        )
    )
    if duplicate:
        raise HTTPException(status_code=409, detail=f"You already have an open request (#{duplicate}) for this listing.")
    if body.assessment_id is not None and db.get(Assessment, body.assessment_id) is None:
        raise HTTPException(status_code=422, detail="The linked assessment does not exist.")
    request = MaterialRequest(
        manufacturer_id=manufacturer.id,
        supplier_id=listing.supplier_id,
        listing_id=listing.id,
        quantity_kg=body.quantity_kg,
        target_price_per_kg=body.target_price_per_kg,
        required_by=body.required_by.isoformat() if body.required_by else None,
        message=body.message.strip(),
        assessment_id=body.assessment_id,
        repeat_of_request_id=repeat_of_request,
        repeat_of_order_id=repeat_of_order,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


def list_requests(db: Session, user: User, status: str = "") -> list[dict]:
    query = select(MaterialRequest).order_by(MaterialRequest.created_at.desc(), MaterialRequest.id.desc())
    if user.role == "manufacturer":
        query = query.where(MaterialRequest.manufacturer_id == user.id)
    else:
        query = query.where(MaterialRequest.supplier_id == user.supplier_profile.id)
    if status:
        query = query.where(MaterialRequest.status == status)
    return [r.to_dict() for r in db.scalars(query).all()]


def get_request(db: Session, user: User, request_id: int) -> MaterialRequest:
    request = db.get(MaterialRequest, request_id)
    allowed = request is not None and (
        (user.role == "manufacturer" and request.manufacturer_id == user.id)
        or (user.role == "supplier" and user.supplier_profile and request.supplier_id == user.supplier_profile.id)
    )
    if not allowed:
        raise _not_found("Request")
    return request


def respond_request(db: Session, user: User, request_id: int, body: RequestResponse) -> MaterialRequest:
    request = get_request(db, user, request_id)
    if request.status not in ("pending", "quoted"):
        raise HTTPException(status_code=409, detail=f"This request is already {request.status} and cannot be answered.")
    if body.action == "accept":
        if request.status == "pending":
            request.quoted_price_per_kg = None  # listed price applies
        request.status = "accepted"
    elif body.action == "quote":
        request.status = "quoted"
        request.quoted_price_per_kg = body.quoted_price_per_kg
    else:
        request.status = "rejected"
    request.supplier_response = body.message.strip()
    request.responded_at = _now()
    db.commit()
    return request


def cancel_request(db: Session, user: User, request_id: int) -> MaterialRequest:
    request = get_request(db, user, request_id)
    if request.status not in OPEN_REQUEST:
        raise HTTPException(status_code=409, detail=f"A request that is {request.status} cannot be cancelled.")
    request.status = "cancelled"
    db.commit()
    return request


def _event(order: Order, status: str, user: User, note: str = "") -> None:
    order.events.append(OrderEvent(status=status, note=note.strip(), actor_role=user.role, actor_name=user.name))


def place_order(db: Session, user: User, request_id: int, body: PlaceOrderInput) -> Order:
    request = get_request(db, user, request_id)
    if request.status not in ("accepted", "quoted"):
        raise HTTPException(status_code=409, detail="An order can only be placed once the supplier has accepted or quoted the request.")
    listing = request.listing
    if request.quantity_kg > listing.available_kg:
        raise HTTPException(status_code=409, detail=f"The supplier now has only {listing.available_kg:g} kg available. Send a new request.")
    price = request.agreed_price
    order = Order(
        request_id=request.id,
        manufacturer_id=request.manufacturer_id,
        supplier_id=request.supplier_id,
        listing_id=listing.id,
        quantity_kg=request.quantity_kg,
        price_per_kg=price,
        currency=listing.currency,
        total_amount=round(price * request.quantity_kg, 2),
        delivery_address=body.delivery_address.strip(),
    )
    _event(order, "placed", user, "Order placed from request #%d at %s %.2f/kg." % (request.id, listing.currency, price))
    listing.available_kg = round(listing.available_kg - request.quantity_kg, 3)  # reserve stock
    request.status = "ordered"
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def list_orders(db: Session, user: User, status: str = "") -> list[dict]:
    query = select(Order).order_by(Order.created_at.desc(), Order.id.desc())
    if user.role == "manufacturer":
        query = query.where(Order.manufacturer_id == user.id)
    else:
        query = query.where(Order.supplier_id == user.supplier_profile.id)
    if status == "open":
        query = query.where(Order.status.in_(OPEN_ORDER))
    elif status:
        query = query.where(Order.status == status)
    return [o.to_dict() for o in db.scalars(query).all()]


def get_order(db: Session, user: User, order_id: int) -> Order:
    order = db.get(Order, order_id)
    allowed = order is not None and (
        (user.role == "manufacturer" and order.manufacturer_id == user.id)
        or (user.role == "supplier" and user.supplier_profile and order.supplier_id == user.supplier_profile.id)
    )
    if not allowed:
        raise _not_found("Order")
    return order


def update_order_status(db: Session, user: User, order_id: int, body: OrderStatusUpdate) -> Order:
    order = get_order(db, user, order_id)
    allowed = TRANSITIONS.get((order.status, body.status))
    if allowed is None:
        raise HTTPException(status_code=409, detail=f"An order that is {order.status} cannot be changed to {body.status}.")
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail=f"Only the {' or '.join(sorted(allowed))} can mark this order as {body.status}.")
    if body.status == "cancelled":
        order.listing.available_kg = round(order.listing.available_kg + order.quantity_kg, 3)  # release reserved stock
    order.status = body.status
    _event(order, body.status, user, body.note)
    db.commit()
    return order


def available_actions(order: Order, user: User) -> list[str]:
    return [target for (source, target), roles in TRANSITIONS.items() if source == order.status and user.role in roles]


def repeat_from_request(db: Session, user: User, request_id: int, body: RepeatRequestInput) -> MaterialRequest:
    source = get_request(db, user, request_id)
    if source.status in OPEN_REQUEST:
        raise HTTPException(status_code=409, detail="This request is still open. Wait for it to finish before repeating it.")
    payload = MaterialRequestInput(
        listing_id=source.listing_id,
        quantity_kg=body.quantity_kg or source.quantity_kg,
        target_price_per_kg=source.target_price_per_kg,
        message=body.message or source.message,
        assessment_id=source.assessment_id,
    )
    return create_request(db, user, payload, repeat_of_request=source.id)


def repeat_from_order(db: Session, user: User, order_id: int, body: RepeatRequestInput) -> MaterialRequest:
    order = get_order(db, user, order_id)
    payload = MaterialRequestInput(
        listing_id=order.listing_id,
        quantity_kg=body.quantity_kg or order.quantity_kg,
        message=body.message or f"Repeat of order #{order.id}.",
        assessment_id=order.request.assessment_id if order.request else None,
    )
    return create_request(db, user, payload, repeat_of_order=order.id)


# ---------------------------------------------------------------- dashboards
def recommended_materials(db: Session) -> list[dict]:
    """Materials the assessment engine recommended switching to, across saved assessments."""
    factors = get_factors()
    counts: dict[str, int] = {}
    for recs in db.scalars(select(Assessment.recommendations)).all():
        for rec in recs or []:
            parts = rec.get("id", "").split(":")
            if parts[0] == "material" and len(parts) == 3:
                counts[parts[2]] = counts.get(parts[2], 0) + 1
    return [
        {"material_id": mid, "name": factors.materials[mid]["name"], "assessments": n}
        for mid, n in sorted(counts.items(), key=lambda kv: -kv[1])
        if mid in factors.materials
    ]


def _counts(rows, field: str) -> dict[str, int]:
    out: dict[str, int] = {}
    for row in rows:
        out[getattr(row, field)] = out.get(getattr(row, field), 0) + 1
    return out


def dashboard(db: Session, user: User) -> dict:
    if user.role == "manufacturer":
        requests = db.scalars(select(MaterialRequest).where(MaterialRequest.manufacturer_id == user.id)).all()
        orders = db.scalars(select(Order).where(Order.manufacturer_id == user.id).order_by(Order.created_at.desc())).all()
        recommended = recommended_materials(db)
        matches = []
        for rec in recommended[:4]:
            listings = search_listings(db, material_id=rec["material_id"], in_stock=True, sort="price_asc")[:3]
            if listings:
                matches.append({**rec, "listings": listings})
        return {
            "role": "manufacturer",
            "requests_by_status": _counts(requests, "status"),
            "orders_by_status": _counts(orders, "status"),
            "open_requests": sum(1 for r in requests if r.status in OPEN_REQUEST),
            "awaiting_your_action": sum(1 for r in requests if r.status in ("accepted", "quoted")),
            "open_orders": sum(1 for o in orders if o.status in OPEN_ORDER),
            "committed_spend": round(sum(o.total_amount for o in orders if o.status != "cancelled"), 2),
            "material_ordered_kg": round(sum(o.quantity_kg for o in orders if o.status != "cancelled"), 1),
            "suppliers_used": len({o.supplier_id for o in orders if o.status != "cancelled"}),
            "recent_orders": [o.to_dict() for o in orders[:5]],
            "recommended_matches": matches,
        }
    profile = user.supplier_profile
    requests = db.scalars(select(MaterialRequest).where(MaterialRequest.supplier_id == profile.id).order_by(MaterialRequest.created_at.desc())).all()
    orders = db.scalars(select(Order).where(Order.supplier_id == profile.id).order_by(Order.created_at.desc())).all()
    listings = profile.listings
    return {
        "role": "supplier",
        "active_listings": sum(1 for x in listings if x.is_active),
        "low_stock": [listing_view(x) for x in listings if x.is_active and x.availability != "in_stock"],
        "requests_by_status": _counts(requests, "status"),
        "orders_by_status": _counts(orders, "status"),
        "pending_requests": sum(1 for r in requests if r.status == "pending"),
        "open_orders": sum(1 for o in orders if o.status in OPEN_ORDER),
        "delivered_revenue": round(sum(o.total_amount for o in orders if o.status == "delivered"), 2),
        "pipeline_value": round(sum(o.total_amount for o in orders if o.status in OPEN_ORDER), 2),
        "material_supplied_kg": round(sum(o.quantity_kg for o in orders if o.status == "delivered"), 1),
        "recent_requests": [r.to_dict() for r in requests[:5]],
        "recent_orders": [o.to_dict() for o in orders[:5]],
    }

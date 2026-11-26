"""Authentication and Supplier Marketplace endpoints (see /api/docs)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.marketplace import SupplierProfile, User
from app.schemas.marketplace import (
    ListingInput,
    LoginRequest,
    MaterialRequestInput,
    OrderStatusUpdate,
    PlaceOrderInput,
    RegisterRequest,
    RepeatRequestInput,
    RequestResponse,
    SupplierProfileUpdate,
)
from app.services import auth
from app.services import marketplace_service as svc

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])
market_router = APIRouter(prefix="/api/market", tags=["marketplace"])


# ------------------------------------------------------------------ auth
@auth_router.post("/register", status_code=201, summary="Create a manufacturer or supplier account")
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    user = auth.create_user(db, **body.model_dump())
    return {"token": auth.issue_token(db, user), "user": user.to_dict()}


@auth_router.post("/login", summary="Sign in and receive a bearer token")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email))
    if user is None or not auth.verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    return {"token": auth.issue_token(db, user), "user": user.to_dict()}


@auth_router.post("/logout", status_code=204)
def logout(authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
    token = auth.bearer_token(authorization)
    if token:
        auth.revoke_token(db, token)
    return Response(status_code=204)


@auth_router.get("/me")
def me(user: User = Depends(auth.current_user)):
    return user.to_dict()


# ------------------------------------------------------------------ reference & browsing (public)
@market_router.get("/meta", summary="Categories, grades and library materials for forms")
def meta():
    return svc.meta()


@market_router.get("/listings", summary="Search active listings")
def listings(
    q: str = "",
    category: str = "",
    material_id: str = "",
    min_grade: str = "",
    location: str = "",
    max_price: float | None = Query(default=None, gt=0),
    in_stock: bool = False,
    sort: str = "relevance",
    db: Session = Depends(get_db),
):
    return svc.search_listings(db, q=q, category=category, material_id=material_id, min_grade=min_grade, location=location, max_price=max_price, in_stock=in_stock, sort=sort)


@market_router.get("/listings/compare", summary="Compare 2–4 listings on price, quality, quantity and availability")
def compare(ids: str, quantity_kg: float | None = Query(default=None, gt=0), db: Session = Depends(get_db)):
    try:
        parsed = [int(x) for x in ids.split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=422, detail="ids must be a comma-separated list of listing numbers.") from None
    return svc.compare_listings(db, parsed, quantity_kg)


@market_router.get("/listings/{listing_id}")
def listing(listing_id: int, db: Session = Depends(get_db)):
    item = svc.get_listing(db, listing_id)
    data = svc.listing_view(item)
    data["supplier"] = item.supplier.to_dict(with_stats=True)
    return data


@market_router.get("/suppliers")
def suppliers(db: Session = Depends(get_db)):
    return svc.list_suppliers(db)


@market_router.get("/suppliers/{supplier_id}")
def supplier(supplier_id: int, db: Session = Depends(get_db)):
    return svc.supplier_public(db, supplier_id)


# ------------------------------------------------------------------ supplier self-service
@market_router.get("/supplier/profile")
def my_profile(profile: SupplierProfile = Depends(auth.require_supplier)):
    return profile.to_dict(with_stats=True)


@market_router.put("/supplier/profile")
def update_my_profile(body: SupplierProfileUpdate, profile: SupplierProfile = Depends(auth.require_supplier), db: Session = Depends(get_db)):
    return svc.update_profile(db, profile, body).to_dict(with_stats=True)


@market_router.get("/supplier/listings", summary="The signed-in supplier's listings, including inactive ones")
def my_listings(profile: SupplierProfile = Depends(auth.require_supplier)):
    return [svc.listing_view(x) for x in sorted(profile.listings, key=lambda x: (-x.is_active, -x.id))]


@market_router.post("/supplier/listings", status_code=201)
def create_listing(body: ListingInput, profile: SupplierProfile = Depends(auth.require_supplier), db: Session = Depends(get_db)):
    return svc.listing_view(svc.create_listing(db, profile, body))


@market_router.put("/supplier/listings/{listing_id}")
def update_listing(listing_id: int, body: ListingInput, profile: SupplierProfile = Depends(auth.require_supplier), db: Session = Depends(get_db)):
    return svc.listing_view(svc.update_listing(db, profile, listing_id, body))


@market_router.delete("/supplier/listings/{listing_id}")
def delete_listing(listing_id: int, profile: SupplierProfile = Depends(auth.require_supplier), db: Session = Depends(get_db)):
    return {"result": svc.delete_listing(db, profile, listing_id)}


# ------------------------------------------------------------------ requests
@market_router.post("/requests", status_code=201, summary="Manufacturer sends a material request")
def create_request(body: MaterialRequestInput, user: User = Depends(auth.require_manufacturer), db: Session = Depends(get_db)):
    return svc.create_request(db, user, body).to_dict()


@market_router.get("/requests", summary="Own requests (manufacturer) or incoming requests (supplier)")
def list_requests(status: str = "", user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return svc.list_requests(db, user, status)


@market_router.get("/requests/{request_id}")
def get_request(request_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return svc.get_request(db, user, request_id).to_dict()


@market_router.post("/requests/{request_id}/respond", summary="Supplier accepts, quotes or rejects")
def respond(request_id: int, body: RequestResponse, profile: SupplierProfile = Depends(auth.require_supplier), db: Session = Depends(get_db)):
    return svc.respond_request(db, profile.user, request_id, body).to_dict()


@market_router.post("/requests/{request_id}/cancel")
def cancel(request_id: int, user: User = Depends(auth.require_manufacturer), db: Session = Depends(get_db)):
    return svc.cancel_request(db, user, request_id).to_dict()


@market_router.post("/requests/{request_id}/order", status_code=201, summary="Place an order from an accepted or quoted request")
def place_order(request_id: int, body: PlaceOrderInput, user: User = Depends(auth.require_manufacturer), db: Session = Depends(get_db)):
    order = svc.place_order(db, user, request_id, body)
    return {**order.to_dict(with_events=True), "actions": svc.available_actions(order, user)}


@market_router.post("/requests/{request_id}/repeat", status_code=201, summary="Send a previous request again")
def repeat_request(request_id: int, body: RepeatRequestInput, user: User = Depends(auth.require_manufacturer), db: Session = Depends(get_db)):
    return svc.repeat_from_request(db, user, request_id, body).to_dict()


# ------------------------------------------------------------------ orders
@market_router.get("/orders", summary="Order history; status=open for orders in progress")
def list_orders(status: str = "", user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return svc.list_orders(db, user, status)


@market_router.get("/orders/{order_id}")
def get_order(order_id: int, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    order = svc.get_order(db, user, order_id)
    return {**order.to_dict(with_events=True), "actions": svc.available_actions(order, user)}


@market_router.post("/orders/{order_id}/status", summary="Advance or cancel an order (role-checked)")
def order_status(order_id: int, body: OrderStatusUpdate, user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    order = svc.update_order_status(db, user, order_id, body)
    return {**order.to_dict(with_events=True), "actions": svc.available_actions(order, user)}


@market_router.post("/orders/{order_id}/repeat", status_code=201, summary="Create a new request from a previous order")
def repeat_order(order_id: int, body: RepeatRequestInput, user: User = Depends(auth.require_manufacturer), db: Session = Depends(get_db)):
    return svc.repeat_from_order(db, user, order_id, body).to_dict()


# ------------------------------------------------------------------ dashboards
@market_router.get("/dashboard", summary="Role-specific marketplace dashboard")
def dashboard(user: User = Depends(auth.current_user), db: Session = Depends(get_db)):
    return svc.dashboard(db, user)


@market_router.get("/recommended-materials", summary="Materials the assessment engine has recommended")
def recommended(db: Session = Depends(get_db)):
    return svc.recommended_materials(db)

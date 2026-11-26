"""Supplier Marketplace: accounts, access control, listings, requests, orders and repeats."""
import itertools

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.auth import hash_password, verify_password
from app.services.marketplace_seed import DEMO_PASSWORD

_ids = itertools.count(1)


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def register(client, role, **extra):
    n = next(_ids)
    body = {"name": f"User {n}", "email": f"user{n}@test.example", "password": "Passw0rd!", "role": role, **extra}
    if role == "supplier":
        body.setdefault("company_name", f"Test Supplier {n}")
        body.setdefault("city", "Pune")
    res = client.post("/api/auth/register", json=body)
    assert res.status_code == 201, res.text
    data = res.json()
    return {"Authorization": f"Bearer {data['token']}"}, data["user"]


def listing_body(**extra):
    body = {"title": "Test rPET flakes", "material_id": "recycled_plastic", "category": "recycled", "form": "Flakes", "price_per_kg": 70, "quality_grade": "B", "recycled_content_pct": 100, "available_kg": 1000, "min_order_kg": 100, "lead_time_days": 5}
    return {**body, **extra}


def new_listing(client, headers, **extra):
    res = client.post("/api/market/supplier/listings", json=listing_body(**extra), headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


# ------------------------------------------------------------------ accounts
def test_password_hashing_round_trip():
    stored = hash_password("Secret123")
    assert stored.startswith("pbkdf2_sha256$") and "Secret123" not in stored
    assert verify_password("Secret123", stored) and not verify_password("secret123", stored)


def test_register_login_me_logout(client):
    headers, user = register(client, "manufacturer", organisation="Acme")
    assert user["role"] == "manufacturer" and user["supplier_id"] is None
    assert client.get("/api/auth/me", headers=headers).json()["email"] == user["email"]
    login = client.post("/api/auth/login", json={"email": user["email"].upper(), "password": "Passw0rd!"})
    assert login.status_code == 200
    assert client.post("/api/auth/login", json={"email": user["email"], "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/logout", headers=headers).status_code == 204
    assert client.get("/api/auth/me", headers=headers).status_code == 401


def test_registration_validation(client):
    weak = client.post("/api/auth/register", json={"name": "A B", "email": "x@y.io", "password": "allletters", "role": "manufacturer"})
    assert weak.status_code == 422
    no_company = client.post("/api/auth/register", json={"name": "A B", "email": "s@y.io", "password": "Passw0rd!", "role": "supplier"})
    assert no_company.status_code == 422 and "company" in no_company.json()["detail"].lower()
    headers, user = register(client, "manufacturer")
    dup = client.post("/api/auth/register", json={"name": "Dup", "email": user["email"], "password": "Passw0rd!", "role": "manufacturer"})
    assert dup.status_code == 409


def test_demo_accounts_are_seeded(client):
    res = client.post("/api/auth/login", json={"email": "manufacturer@wbw.demo", "password": DEMO_PASSWORD})
    assert res.status_code == 200 and res.json()["user"]["is_demo"]
    assert len(client.get("/api/market/listings").json()) >= 10


# ------------------------------------------------------------------ access control
def test_role_restrictions(client):
    maker, _ = register(client, "manufacturer")
    supplier, _ = register(client, "supplier")
    assert client.post("/api/market/supplier/listings", json=listing_body(), headers=maker).status_code == 403
    listing = new_listing(client, supplier)
    req = {"listing_id": listing["id"], "quantity_kg": 200}
    assert client.post("/api/market/requests", json=req, headers=supplier).status_code == 403
    assert client.post("/api/market/requests", json=req).status_code == 401


def test_supplier_cannot_touch_another_suppliers_data(client):
    a, _ = register(client, "supplier")
    b, _ = register(client, "supplier")
    maker, _ = register(client, "manufacturer")
    listing = new_listing(client, a)
    assert client.put(f"/api/market/supplier/listings/{listing['id']}", json=listing_body(price_per_kg=1), headers=b).status_code == 404
    request = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200}, headers=maker).json()
    assert client.post(f"/api/market/requests/{request['id']}/respond", json={"action": "accept"}, headers=b).status_code == 404
    assert client.get(f"/api/market/requests/{request['id']}", headers=b).status_code == 404
    other_maker, _ = register(client, "manufacturer")
    assert client.get(f"/api/market/requests/{request['id']}", headers=other_maker).status_code == 404


# ------------------------------------------------------------------ listings
def test_listing_crud_and_validation(client):
    supplier, _ = register(client, "supplier", state="Maharashtra")
    listing = new_listing(client, supplier)
    assert listing["location"] == "Pune, Maharashtra" and listing["library"]["emission_factor"] > 0
    bad = client.post("/api/market/supplier/listings", json=listing_body(price_per_kg=0), headers=supplier)
    assert bad.status_code == 422
    unknown = client.post("/api/market/supplier/listings", json=listing_body(material_id="unobtainium"), headers=supplier)
    assert unknown.status_code == 422
    updated = client.put(f"/api/market/supplier/listings/{listing['id']}", json=listing_body(price_per_kg=65, is_active=False), headers=supplier).json()
    assert updated["price_per_kg"] == 65 and not updated["is_active"]
    assert client.get(f"/api/market/listings/{listing['id']}").status_code == 404  # inactive listings are hidden
    assert client.delete(f"/api/market/supplier/listings/{listing['id']}", headers=supplier).json()["result"] == "deleted"


def test_search_filters_and_sorting(client):
    by_price = client.get("/api/market/listings?sort=price_asc").json()
    prices = [x["price_per_kg"] for x in by_price]
    assert prices == sorted(prices)
    recycled_pet = client.get("/api/market/listings?material_id=recycled_plastic").json()
    assert recycled_pet and all(x["material_id"] == "recycled_plastic" for x in recycled_pet)
    grade_a = client.get("/api/market/listings?min_grade=A").json()
    assert grade_a and all(x["quality_grade"] == "A" for x in grade_a)
    waste = client.get("/api/market/listings?category=waste_based").json()
    assert waste and all(x["category"] == "waste_based" for x in waste)
    assert all(x["price_per_kg"] <= 50 for x in client.get("/api/market/listings?max_price=50").json())
    assert client.get("/api/market/listings?q=bagasse").json()[0]["title"].lower().startswith("bagasse")


def test_compare_listings(client):
    supplier, _ = register(client, "supplier")
    cheap = new_listing(client, supplier, price_per_kg=50, quality_grade="C", available_kg=300, min_order_kg=50)
    good = new_listing(client, supplier, title="Premium rPET", price_per_kg=90, quality_grade="A", available_kg=5000, min_order_kg=500)
    res = client.get(f"/api/market/listings/compare?ids={cheap['id']},{good['id']}&quantity_kg=400").json()
    assert res["best"]["lowest_price"] == cheap["id"]
    assert res["best"]["highest_quality"] == good["id"]
    assert res["best"]["most_available"] == good["id"]
    checks = {x["id"]: x["quantity_check"] for x in res["listings"]}
    assert checks[cheap["id"]]["can_supply"] is False and "available" in checks[cheap["id"]]["issues"][0]
    assert checks[good["id"]]["issues"] == ["Below the minimum order of 500 kg"]
    assert checks[good["id"]]["total_cost"] == 36000
    assert client.get(f"/api/market/listings/compare?ids={cheap['id']}").status_code == 422


# ------------------------------------------------------------------ requests and orders
@pytest.fixture
def trio(client):
    supplier, _ = register(client, "supplier")
    maker, _ = register(client, "manufacturer")
    listing = new_listing(client, supplier)
    return supplier, maker, listing


def test_request_validation(client, trio):
    supplier, maker, listing = trio
    below = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 50}, headers=maker)
    assert below.status_code == 422 and "minimum" in below.json()["detail"]
    above = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 5000}, headers=maker)
    assert above.status_code == 422 and "available" in above.json()["detail"]
    past = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200, "required_by": "2000-01-01"}, headers=maker)
    assert past.status_code == 422
    first = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200}, headers=maker)
    assert first.status_code == 201
    again = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200}, headers=maker)
    assert again.status_code == 409


def test_full_order_lifecycle_with_quote(client, trio):
    supplier, maker, listing = trio
    req = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 400, "message": "For a pilot batch"}, headers=maker).json()
    assert req["status"] == "pending" and req["estimated_total"] == 28000
    incoming = client.get("/api/market/requests?status=pending", headers=supplier).json()
    assert [r["id"] for r in incoming] == [req["id"]]

    no_price = client.post(f"/api/market/requests/{req['id']}/respond", json={"action": "quote"}, headers=supplier)
    assert no_price.status_code == 422
    quoted = client.post(f"/api/market/requests/{req['id']}/respond", json={"action": "quote", "quoted_price_per_kg": 65, "message": "Volume discount"}, headers=supplier).json()
    assert quoted["status"] == "quoted" and quoted["agreed_price_per_kg"] == 65

    order = client.post(f"/api/market/requests/{req['id']}/order", json={"delivery_address": "Plant 2, Pune"}, headers=maker)
    assert order.status_code == 201
    order = order.json()
    assert order["total_amount"] == 26000 and order["status"] == "placed" and order["actions"] == ["cancelled"]
    assert client.get(f"/api/market/listings/{listing['id']}").json()["available_kg"] == 600  # stock reserved
    assert client.get(f"/api/market/requests/{req['id']}", headers=maker).json()["status"] == "ordered"

    # manufacturer cannot confirm; supplier walks the order through
    assert client.post(f"/api/market/orders/{order['id']}/status", json={"status": "confirmed"}, headers=maker).status_code == 403
    assert client.post(f"/api/market/orders/{order['id']}/status", json={"status": "delivered"}, headers=supplier).status_code == 409
    for status in ("confirmed", "dispatched"):
        res = client.post(f"/api/market/orders/{order['id']}/status", json={"status": status, "note": f"now {status}"}, headers=supplier)
        assert res.status_code == 200 and res.json()["status"] == status
    done = client.post(f"/api/market/orders/{order['id']}/status", json={"status": "delivered"}, headers=maker).json()
    assert [e["status"] for e in done["events"]] == ["placed", "confirmed", "dispatched", "delivered"]
    assert done["actions"] == []
    assert client.post(f"/api/market/orders/{order['id']}/status", json={"status": "cancelled"}, headers=maker).status_code == 409

    history = client.get("/api/market/orders?status=delivered", headers=maker).json()
    assert order["id"] in [o["id"] for o in history]
    assert client.get("/api/market/dashboard", headers=supplier).json()["delivered_revenue"] == 26000


def test_reject_and_cancel(client, trio):
    supplier, maker, listing = trio
    req = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200}, headers=maker).json()
    assert client.post(f"/api/market/requests/{req['id']}/respond", json={"action": "reject"}, headers=supplier).status_code == 422
    rejected = client.post(f"/api/market/requests/{req['id']}/respond", json={"action": "reject", "message": "Out of season"}, headers=supplier).json()
    assert rejected["status"] == "rejected" and rejected["supplier_response"] == "Out of season"
    assert client.post(f"/api/market/requests/{req['id']}/order", json={"delivery_address": "Plant 2, Pune"}, headers=maker).status_code == 409
    assert client.post(f"/api/market/requests/{req['id']}/cancel", headers=maker).status_code == 409

    second = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200}, headers=maker).json()
    cancelled = client.post(f"/api/market/requests/{second['id']}/cancel", headers=maker).json()
    assert cancelled["status"] == "cancelled"
    assert client.post(f"/api/market/requests/{second['id']}/respond", json={"action": "accept"}, headers=supplier).status_code == 409


def test_order_cancellation_returns_stock(client, trio):
    supplier, maker, listing = trio
    req = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 300}, headers=maker).json()
    client.post(f"/api/market/requests/{req['id']}/respond", json={"action": "accept"}, headers=supplier)
    order = client.post(f"/api/market/requests/{req['id']}/order", json={"delivery_address": "Plant 2, Pune"}, headers=maker).json()
    assert order["price_per_kg"] == 70
    assert client.get(f"/api/market/listings/{listing['id']}").json()["available_kg"] == 700
    client.post(f"/api/market/orders/{order['id']}/status", json={"status": "cancelled", "note": "Plan changed"}, headers=maker)
    assert client.get(f"/api/market/listings/{listing['id']}").json()["available_kg"] == 1000


def test_repeat_request_and_repeat_order(client, trio):
    supplier, maker, listing = trio
    req = client.post("/api/market/requests", json={"listing_id": listing["id"], "quantity_kg": 200}, headers=maker).json()
    assert client.post(f"/api/market/requests/{req['id']}/repeat", json={}, headers=maker).status_code == 409  # still open
    client.post(f"/api/market/requests/{req['id']}/respond", json={"action": "accept"}, headers=supplier)
    order = client.post(f"/api/market/requests/{req['id']}/order", json={"delivery_address": "Plant 2, Pune"}, headers=maker).json()

    repeat = client.post(f"/api/market/orders/{order['id']}/repeat", json={"quantity_kg": 250}, headers=maker)
    assert repeat.status_code == 201
    repeat = repeat.json()
    assert repeat["status"] == "pending" and repeat["quantity_kg"] == 250 and repeat["repeat_of_order_id"] == order["id"]

    client.post(f"/api/market/requests/{repeat['id']}/cancel", headers=maker)
    again = client.post(f"/api/market/requests/{repeat['id']}/repeat", json={}, headers=maker).json()
    assert again["repeat_of_request_id"] == repeat["id"] and again["quantity_kg"] == 250


def test_manufacturer_dashboard_links_to_assessment_recommendations(client):
    res = client.post("/api/auth/login", json={"email": "manufacturer@wbw.demo", "password": DEMO_PASSWORD}).json()
    dash = client.get("/api/market/dashboard", headers={"Authorization": f"Bearer {res['token']}"}).json()
    assert dash["role"] == "manufacturer" and dash["recent_orders"]
    recommended = {m["material_id"] for m in dash["recommended_matches"]}
    assert "recycled_plastic" in recommended  # the demo bottle assessment recommends rPET
    for match in dash["recommended_matches"]:
        assert all(item["material_id"] == match["material_id"] for item in match["listings"])

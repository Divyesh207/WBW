"""Demonstration accounts, suppliers and listings for the Supplier Marketplace.

All companies, people, prices and stock levels below are FICTIONAL demo data,
created so the marketplace can be demonstrated end to end. Every demo account
is flagged is_demo and shown with a "Demo" label in the interface.

Demo sign-in (test values, local prototype only):
    manufacturer@wbw.demo   / Demo@2026
    ecopolymer@wbw.demo     / Demo@2026   (supplier)
    metalloop@wbw.demo      / Demo@2026   (supplier)
    fibrecycle@wbw.demo     / Demo@2026   (supplier)
    agrowaste@wbw.demo      / Demo@2026   (supplier)
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.marketplace import Listing, MaterialRequest, Order, OrderEvent, User
from app.services.auth import create_user

DEMO_PASSWORD = "Demo@2026"

SUPPLIERS = [
    {
        "email": "ecopolymer@wbw.demo",
        "name": "Rohan Kulkarni",
        "company_name": "EcoPolymer Recyclers (Demo)",
        "city": "Pune",
        "state": "Maharashtra",
        "supplier_type": "recycler",
        "description": "Mechanical recycler of post-consumer PET and HDPE bottles. Washed flakes and extruded pellets for packaging and moulding.",
        "certifications": ["ISO 9001 (demo)", "Food-contact rPET grade (demo)"],
        "listings": [
            {"title": "rPET clear flakes, hot-washed", "material_id": "recycled_plastic", "category": "recycled", "form": "Flakes", "price_per_kg": 68, "quality_grade": "B", "recycled_content_pct": 100, "available_kg": 18000, "min_order_kg": 500, "lead_time_days": 5, "description": "Post-consumer bottle flakes, hot-washed and sorted. Suitable for strapping, fibre and non-food packaging."},
            {"title": "Food-grade rPET pellets", "material_id": "recycled_plastic", "category": "recycled", "form": "Pellets", "price_per_kg": 96, "quality_grade": "A", "recycled_content_pct": 100, "available_kg": 6000, "min_order_kg": 1000, "lead_time_days": 10, "description": "Decontaminated, extruded rPET pellets intended for bottle preforms."},
        ],
    },
    {
        "email": "metalloop@wbw.demo",
        "name": "Sneha Joshi",
        "company_name": "MetalLoop Secondary Alloys (Demo)",
        "city": "Chakan",
        "state": "Maharashtra",
        "supplier_type": "recycler",
        "description": "Remelts sorted aluminium scrap from automotive and packaging streams into secondary ingots and billets.",
        "certifications": ["ISO 14001 (demo)"],
        "listings": [
            {"title": "Secondary aluminium ingots (ADC12)", "material_id": "recycled_aluminium", "category": "recycled", "form": "Ingots", "price_per_kg": 205, "quality_grade": "B", "recycled_content_pct": 95, "available_kg": 9000, "min_order_kg": 250, "lead_time_days": 7, "description": "Die-casting alloy from remelted scrap. Composition certificate with each lot."},
            {"title": "Recycled aluminium billets (6063)", "material_id": "recycled_aluminium", "category": "recycled", "form": "Billets", "price_per_kg": 238, "quality_grade": "A", "recycled_content_pct": 75, "available_kg": 1200, "min_order_kg": 300, "lead_time_days": 14, "description": "Extrusion billets with 75% post-industrial scrap content."},
        ],
    },
    {
        "email": "fibrecycle@wbw.demo",
        "name": "Imran Shaikh",
        "company_name": "FibreCycle Paper & Board (Demo)",
        "city": "Nashik",
        "state": "Maharashtra",
        "supplier_type": "material_supplier",
        "description": "Recycled-fibre paper, corrugated board and moulded pulp packaging made from collected cartons.",
        "certifications": ["FSC Recycled (demo)"],
        "listings": [
            {"title": "Recycled kraft paper, 120 gsm", "material_id": "recycled_paper", "category": "recycled", "form": "Reels", "price_per_kg": 42, "quality_grade": "B", "recycled_content_pct": 100, "available_kg": 25000, "min_order_kg": 1000, "lead_time_days": 6, "description": "Unbleached kraft from 100% recovered fibre for wrapping and bags."},
            {"title": "Corrugated board sheets, 3-ply", "material_id": "cardboard", "category": "recycled", "form": "Sheets", "price_per_kg": 38, "quality_grade": "B", "recycled_content_pct": 80, "available_kg": 14000, "min_order_kg": 500, "lead_time_days": 4, "description": "3-ply board with 80% recovered fibre, cut to size on request."},
            {"title": "Moulded pulp protective trays", "material_id": None, "category": "recycled", "form": "Moulded parts", "price_per_kg": 75, "quality_grade": "C", "recycled_content_pct": 100, "available_kg": 2000, "min_order_kg": 200, "lead_time_days": 12, "description": "Replacement for foam inserts. Custom tooling available."},
        ],
    },
    {
        "email": "agrowaste@wbw.demo",
        "name": "Priya Deshmukh",
        "company_name": "AgroWaste Materials Co. (Demo)",
        "city": "Kolhapur",
        "state": "Maharashtra",
        "supplier_type": "waste_producer",
        "description": "Turns agricultural residues from sugar and rice mills into boards, fillers and natural fibres.",
        "certifications": [],
        "listings": [
            {"title": "Bagasse fibre board", "material_id": None, "category": "waste_based", "form": "Boards", "price_per_kg": 55, "quality_grade": "B", "recycled_content_pct": 0, "available_kg": 8000, "min_order_kg": 300, "lead_time_days": 9, "description": "Board pressed from sugar-mill bagasse, a by-product that is otherwise burned."},
            {"title": "Engineered bamboo strips", "material_id": "bamboo", "category": "bio_based", "form": "Strips", "price_per_kg": 88, "quality_grade": "A", "recycled_content_pct": 0, "available_kg": 3500, "min_order_kg": 100, "lead_time_days": 15, "description": "Laminated bamboo strips for furniture and consumer goods."},
            {"title": "Rice-husk composite filler", "material_id": None, "category": "waste_based", "form": "Powder", "price_per_kg": 24, "quality_grade": "C", "recycled_content_pct": 0, "available_kg": 300, "min_order_kg": 100, "lead_time_days": 7, "description": "Milled husk filler for bio-composites. Limited batch."},
        ],
    },
]

MANUFACTURER = {"email": "manufacturer@wbw.demo", "name": "Asha Patil", "organisation": "GreenPack Bottling (Demo)"}


def seed_marketplace(db: Session) -> int:
    """Create demo accounts and history once; does nothing if any user exists."""
    if db.scalar(select(User.id).limit(1)) is not None:
        return 0
    listings: dict[str, Listing] = {}
    supplier_users: dict[str, User] = {}
    for spec in SUPPLIERS:
        user = create_user(db, email=spec["email"], name=spec["name"], password=DEMO_PASSWORD, role="supplier", company_name=spec["company_name"], city=spec["city"], state=spec["state"], supplier_type=spec["supplier_type"], is_demo=True)
        profile = user.supplier_profile
        profile.description = spec["description"]
        profile.certifications = spec["certifications"]
        for item in spec["listings"]:
            listing = Listing(supplier_id=profile.id, location=f"{spec['city']}, {spec['state']}", **item)
            db.add(listing)
            listings[item["title"]] = listing
        supplier_users[spec["email"]] = user
    maker = create_user(db, email=MANUFACTURER["email"], name=MANUFACTURER["name"], password=DEMO_PASSWORD, role="manufacturer", organisation=MANUFACTURER["organisation"], is_demo=True)
    db.flush()

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    flakes = listings["rPET clear flakes, hot-washed"]
    board = listings["Corrugated board sheets, 3-ply"]
    ingots = listings["Secondary aluminium ingots (ADC12)"]
    pellets = listings["Food-grade rPET pellets"]
    eco = supplier_users["ecopolymer@wbw.demo"]
    fibre = supplier_users["fibrecycle@wbw.demo"]
    metal = supplier_users["metalloop@wbw.demo"]
    address = "Plot 12, MIDC Bhosari, Pune 411026 (demo address)"

    def history(listing, qty, days, status, *, quote=None, response="", order_status=None, steps=()):
        req = MaterialRequest(manufacturer_id=maker.id, supplier_id=listing.supplier_id, listing_id=listing.id, quantity_kg=qty, status=status, quoted_price_per_kg=quote, supplier_response=response, message="Demo request for pilot production.", created_at=now - timedelta(days=days), updated_at=now - timedelta(days=days - 1), responded_at=(now - timedelta(days=days - 1)) if status != "pending" else None)
        db.add(req)
        db.flush()
        if order_status:
            price = quote if quote is not None else listing.price_per_kg
            order = Order(request_id=req.id, manufacturer_id=maker.id, supplier_id=listing.supplier_id, listing_id=listing.id, quantity_kg=qty, price_per_kg=price, total_amount=round(price * qty, 2), delivery_address=address, status=order_status, created_at=now - timedelta(days=days - 1))
            db.add(order)
            db.flush()
            listing.available_kg -= qty
            for offset, (st, actor, note) in enumerate(steps):
                db.add(OrderEvent(order_id=order.id, status=st, note=note, actor_role=actor.role, actor_name=actor.name, created_at=now - timedelta(days=days - 1 - offset)))

    history(flakes, 2000, 21, "ordered", response="Accepted at listed price.", order_status="delivered", steps=[("placed", maker, "Order placed."), ("confirmed", eco, "Lot reserved."), ("dispatched", eco, "Dispatched by road, LR no. DEMO-1182."), ("delivered", maker, "Received in full.")])
    history(board, 1500, 9, "ordered", quote=36, response="Quoted for a 1,500 kg run.", order_status="dispatched", steps=[("placed", maker, "Order placed."), ("confirmed", fibre, ""), ("dispatched", fibre, "Expected in 2 days.")])
    history(ingots, 500, 3, "quoted", quote=198, response="Can offer ₹198/kg for 500 kg this month.")
    history(pellets, 1000, 1, "pending")
    db.commit()
    return len(SUPPLIERS) + 1

"""Diagrams and charts for the Waste Before Waste project report.

Run from the repository root:  python docs/report/make_figures.py
Charts use engine_data.json, produced by running the real assessment engine
on the four demonstration products.
"""
import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

HERE = Path(__file__).resolve().parent
OUT = HERE / "images" / "figures"
OUT.mkdir(parents=True, exist_ok=True)
DATA = json.loads((HERE / "engine_data.json").read_text(encoding="utf-8"))

plt.rcParams.update({"font.family": "Times New Roman", "font.size": 11, "axes.titlesize": 12})
DARK, GREEN, EMERALD, PAPER, LINE, INK, MUTED = "#064E3B", "#166534", "#10B981", "#F3F7F1", "#9DB5A6", "#14261D", "#5B6B62"
AMBER, SLATE, LIME = "#D97706", "#64748B", "#84CC16"


def box(ax, x, y, w, h, text, fc=PAPER, ec=GREEN, tc=INK, size=10, bold=False, round_=0.04):
    ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.005,rounding_size={round_}", fc=fc, ec=ec, lw=1.2))
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=size, color=tc, fontweight="bold" if bold else "normal", wrap=True)


def arrow(ax, x1, y1, x2, y2, text="", color=GREEN, style="-|>", rad=0.0, size=8.5, offset=(0, 0.012)):
    ax.add_patch(FancyArrowPatch((x1, y1), (x2, y2), arrowstyle=style, mutation_scale=12, color=color, lw=1.2, connectionstyle=f"arc3,rad={rad}"))
    if text:
        ax.text((x1 + x2) / 2 + offset[0], (y1 + y2) / 2 + offset[1], text, ha="center", va="bottom", fontsize=size, color=MUTED, style="italic")


def canvas(w, h):
    fig, ax = plt.subplots(figsize=(w, h))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")
    return fig, ax


def save(fig, name):
    fig.savefig(OUT / name, dpi=220, bbox_inches="tight", facecolor="white")
    plt.close(fig)


# ------------------------------------------------------------------ 1. architecture
def architecture():
    fig, ax = canvas(9, 6.6)
    tiers = [(0.79, 0.19, "PRESENTATION TIER · browser"), (0.40, 0.33, "APPLICATION TIER · Python FastAPI server"), (0.02, 0.30, "DATA TIER")]
    for y, h, label in tiers:
        ax.add_patch(FancyBboxPatch((0.01, y), 0.98, h, boxstyle="round,pad=0.005,rounding_size=0.02", fc="white", ec=LINE, lw=1, ls="--"))
        ax.text(0.03, y + h - 0.012, label, fontsize=8.5, color=MUTED, va="top", fontweight="bold")
    for x, t in [(0.05, "Landing page\n(3D scroll story, Three.js)"), (0.365, "Assessment module\n(wizard, results, reports)"), (0.68, "Supplier Marketplace\n(manufacturer & supplier UIs)")]:
        box(ax, x, 0.84, 0.27, 0.08, t, size=9)
    ax.text(0.5, 0.805, "React 18 · TypeScript · Tailwind CSS · Recharts · Framer Motion · React Router", ha="center", fontsize=8.3, color=MUTED)
    arrow(ax, 0.5, 0.79, 0.5, 0.73, style="<|-|>")
    ax.text(0.52, 0.758, "JSON REST over HTTP (/api); bearer token for marketplace", fontsize=8.3, color=MUTED, style="italic", va="center")
    routes = [(0.05, "Assessment & report\nroutes"), (0.28, "Reference & lab\nroutes"), (0.51, "Auth routes\n(register, login)"), (0.74, "Marketplace routes\n(listings, requests, orders)")]
    for x, t in routes:
        box(ax, x, 0.615, 0.21, 0.07, t, fc=DARK, ec=DARK, tc="white", size=8.5)
    ax.text(0.5, 0.585, "Pydantic input validation  ·  role and ownership checks on every marketplace call", ha="center", fontsize=8.3, color=MUTED)
    svc = [("Assessment\nengine", 0.04), ("Recommendation\nengine", 0.195), ("Comparison\nengine", 0.35), ("PDF report\ngenerator", 0.505), ("Auth service\n(PBKDF2, tokens)", 0.66), ("Marketplace\nservice", 0.815)]
    for text, x in svc:
        box(ax, x, 0.44, 0.14, 0.09, text, size=8.5)
    box(ax, 0.04, 0.06, 0.43, 0.19, "Environmental factor datasets (JSON)\n\nmaterials · energy & processes · transport\npackaging · end-of-life\n(illustrative values + IPCC AR5 electricity)", fc="white", size=9)
    box(ax, 0.53, 0.06, 0.43, 0.19, "SQLite database (SQLAlchemy ORM)\n\nassessments · users · auth_tokens\nsupplier_profiles · listings\nmaterial_requests · orders · order_events", fc="white", size=9)
    for x in (0.11, 0.265, 0.42):
        arrow(ax, x, 0.44, min(x, 0.40), 0.25)
    ax.text(0.19, 0.33, "read factors", fontsize=8.3, color=MUTED, style="italic", ha="center")
    for x in (0.575, 0.73, 0.885):
        arrow(ax, x, 0.44, x, 0.25, style="<|-|>")
    ax.text(0.81, 0.33, "read / write records", fontsize=8.3, color=MUTED, style="italic", ha="center")
    save(fig, "fig_architecture.png")


# ------------------------------------------------------------------ 2. overall workflow
def workflow():
    fig, ax = canvas(9, 5.6)
    steps_top = ["Enter product\nspecification", "Validate inputs\n(5-step wizard)", "Estimate impact\n(5 life-cycle stages)", "Identify\nhotspots", "Generate & test\nalternatives"]
    w, h = 0.165, 0.11
    xs = [0.02 + i * 0.198 for i in range(5)]
    ax.text(0.02, 0.97, "A. Environmental assessment", fontsize=10, color=GREEN, fontweight="bold", va="top")
    for i, (x, t) in enumerate(zip(xs, steps_top)):
        box(ax, x, 0.78, w, h, t, size=9, fc=DARK if i == 0 else PAPER, tc="white" if i == 0 else INK)
        if i:
            arrow(ax, xs[i - 1] + w, 0.835, x, 0.835)
    for x, t in zip([xs[4], xs[3], xs[2]], ["Select alternatives\n& recalculate", "Compare original\nvs. optimised", "Download report\n(PDF / JSON)"]):
        box(ax, x, 0.58, w, h, t, size=9)
    arrow(ax, xs[4] + w / 2, 0.78, xs[4] + w / 2, 0.69)
    arrow(ax, xs[4], 0.635, xs[3] + w, 0.635)
    arrow(ax, xs[3], 0.635, xs[2] + w, 0.635)
    ax.text(0.13, 0.48, "B. Supplier Marketplace", fontsize=10, color=GREEN, fontweight="bold", va="top")
    steps_mkt = ["Find suppliers for\nrecommended material", "Compare listings\n(price, grade, stock)", "Send material\nrequest", "Supplier accepts /\nquotes / declines", "Place order &\ntrack delivery", "Repeat order"]
    xm = [0.02 + i * 0.165 for i in range(6)]
    for i, (x, t) in enumerate(zip(xm, steps_mkt)):
        box(ax, x, 0.25, 0.14, 0.13, t, size=8.5, fc="white", ec=EMERALD)
        if i:
            arrow(ax, xm[i - 1] + 0.14, 0.315, x, 0.315)
    gx = xs[0] + w / 2
    ax.plot([xs[4] + w + 0.004, 0.985, 0.985, gx], [0.835, 0.835, 0.54, 0.54], color=GREEN, lw=1.2)
    arrow(ax, gx, 0.54, gx, 0.38)
    ax.text(0.62, 0.525, "if a material swap is recommended: Find suppliers for this material", fontsize=8.3, color=MUTED, style="italic", ha="center", va="top")
    rx, sx = xm[5] + 0.07, xm[2] + 0.07
    ax.plot([rx, rx, sx], [0.25, 0.19, 0.19], color=GREEN, lw=1.2)
    arrow(ax, sx, 0.19, sx, 0.25)
    ax.text((rx + sx) / 2, 0.15, "repeat a previous request or order", fontsize=8.3, color=MUTED, style="italic", ha="center")
    ax.text(0.5, 0.05, "All impact figures are model estimates from illustrative factors; suppliers set their own prices and stock.", ha="center", fontsize=8.5, color=MUTED, style="italic")
    save(fig, "fig_workflow.png")


# ------------------------------------------------------------------ 3. assessment workflow
def assessment():
    fig, ax = canvas(9, 5.0)
    box(ax, 0.01, 0.62, 0.22, 0.24, "User inputs (per unit)\n\nmaterials & masses, scrap %,\nelectricity, water, packaging,\ndistance & mode, disposal", size=8.5, fc=DARK, ec=DARK, tc="white")
    box(ax, 0.01, 0.26, 0.22, 0.24, "Factor library (JSON)\n\nkg CO2e/kg, MJ/kg, L/kg,\nkg CO2e/kWh, kg CO2e/t·km,\nend-of-life factors", size=8.5, fc="white")
    stages = [("Raw materials", "m ÷ (1 − w) × EF"), ("Manufacturing energy", "E × EF(electricity)"), ("Packaging", "m(pack) × EF(pack)"), ("Transportation", "(m + m(pack)) / 1000 × d × EF(mode)"), ("End-of-life", "mass × EF(family, route)")]
    ys = [0.82 - i * 0.16 for i in range(5)]
    bus = 0.285
    ax.plot([bus, bus], [ys[-1] + 0.06, ys[0] + 0.06], color=GREEN, lw=1.4)
    ax.plot([0.23, bus], [0.74, 0.74], color=GREEN, lw=1.4)
    ax.plot([0.23, bus], [0.38, 0.38], color=GREEN, lw=1.4)
    for (name, f), y in zip(stages, ys):
        box(ax, 0.33, y, 0.31, 0.12, f"{name}\n{f}", size=8.5)
        arrow(ax, bus, y + 0.06, 0.33, y + 0.06)
        arrow(ax, 0.64, y + 0.06, 0.72, 0.52)
    box(ax, 0.72, 0.44, 0.12, 0.16, "Σ stages\n= carbon\nper unit", size=9, fc=DARK, ec=DARK, tc="white", bold=True)
    box(ax, 0.87, 0.66, 0.12, 0.13, "× quantity\n= batch", size=8.5)
    box(ax, 0.87, 0.44, 0.12, 0.16, "Uncertainty\nrange &\ndata quality", size=8.5)
    box(ax, 0.87, 0.22, 0.12, 0.16, "Hotspots\n(≥10% share,\nhigh energy,\nscrap, water)", size=8.5)
    for y in (0.725, 0.52, 0.30):
        arrow(ax, 0.84, 0.52, 0.87, y)
    ax.text(0.33, 0.06, "Energy, water, raw material and waste are calculated in parallel from the same inputs.", fontsize=8.5, color=MUTED, style="italic")
    save(fig, "fig_assessment_flow.png")


# ------------------------------------------------------------------ 4. recommendation workflow
def recommendation():
    fig, ax = canvas(9, 4.6)
    seq = [("Assessment\nresult", DARK, "white"), ("Rules fire on\nhotspots & inputs", PAPER, INK), ("Express change as\noperations on spec", PAPER, INK), ("Apply to a copy &\nre-run the engine", PAPER, INK), ("Compare 5 indicators\nwith original", PAPER, INK)]
    xs = [0.01 + i * 0.198 for i in range(5)]
    for i, (t, fc, tc) in enumerate(seq):
        box(ax, xs[i], 0.68, 0.165, 0.17, t, fc=fc, tc=tc, size=9)
        if i:
            arrow(ax, xs[i] - 0.033, 0.765, xs[i], 0.765)
    verdicts = [("Advisory\nchanges design or business\nmodel, not recalculated", SLATE), ("Beneficial\nsome improve, none worse\n→ pre-selected", EMERALD), ("Mixed\nsome improve, some worse\n→ shown, not pre-selected", AMBER), ("Not beneficial\nnothing improves\n→ ranked last", "#DC2626")]
    vx = [0.01 + i * 0.25 for i in range(4)]
    for (t, c), x in zip(verdicts, vx):
        box(ax, x, 0.25, 0.22, 0.2, t, fc="white", ec=c, size=8.5)
    arrow(ax, xs[1] + 0.06, 0.68, vx[0] + 0.11, 0.45, color=SLATE)
    for x in vx[1:]:
        arrow(ax, xs[4] + 0.0825, 0.68, x + 0.11, 0.45)
    ax.text(0.5, 0.12, "Improvements under 5% are flagged as within uncertainty. Material swaps link to marketplace suppliers of that material.", ha="center", fontsize=8.5, color=MUTED, style="italic")
    save(fig, "fig_recommendation_flow.png")


# ------------------------------------------------------------------ 5. manufacturer–supplier sequence
def sequence():
    fig, ax = canvas(9, 6.2)
    lanes = [("Manufacturer", 0.15), ("Platform (API + database)", 0.5), ("Supplier / waste producer", 0.85)]
    for name, x in lanes:
        box(ax, x - 0.13, 0.92, 0.26, 0.06, name, fc=DARK, ec=DARK, tc="white", size=9.5, bold=True)
        ax.plot([x, x], [0.04, 0.92], color=LINE, lw=1, ls="--")
    msgs = [
        (0.85, 0.5, "Publish listing (price, grade, stock, MOQ)"),
        (0.15, 0.5, "Browse / filter / compare listings"),
        (0.15, 0.5, "Send request (quantity, target price, date)"),
        (0.5, 0.85, "New request appears in supplier inbox"),
        (0.85, 0.5, "Accept  |  Quote price  |  Decline (reason)"),
        (0.5, 0.15, "Request status: accepted / quoted / rejected"),
        (0.15, 0.5, "Place order + delivery address → stock reserved"),
        (0.85, 0.5, "Confirm → Dispatch (notes logged as events)"),
        (0.15, 0.5, "Mark delivered, or cancel early (stock returned)"),
        (0.15, 0.5, "Repeat request / repeat order"),
    ]
    y = 0.86
    for x1, x2, t in msgs:
        arrow(ax, x1, y, x2, y, t, color=GREEN, size=8.5, offset=(0, 0.006))
        y -= 0.083
    save(fig, "fig_sequence.png")


# ------------------------------------------------------------------ 6. use case
def usecase():
    fig, ax = canvas(9, 6.4)
    ax.add_patch(FancyBboxPatch((0.2, 0.03), 0.6, 0.94, boxstyle="round,pad=0.005,rounding_size=0.02", fc="white", ec=GREEN, lw=1.2))
    ax.text(0.5, 0.945, "Waste Before Waste platform", ha="center", fontsize=10.5, color=GREEN, fontweight="bold")

    def actor(x, y, name):
        ax.add_patch(plt.Circle((x, y + 0.07), 0.02, fc="white", ec=INK, lw=1.2))
        ax.plot([x, x], [y + 0.05, y - 0.01], color=INK, lw=1.2)
        ax.plot([x - 0.03, x + 0.03], [y + 0.03, y + 0.03], color=INK, lw=1.2)
        ax.plot([x, x - 0.025], [y - 0.01, y - 0.05], color=INK, lw=1.2)
        ax.plot([x, x + 0.025], [y - 0.01, y - 0.05], color=INK, lw=1.2)
        ax.text(x, y - 0.075, name, ha="center", va="top", fontsize=9.5)

    def case(x, y, t, fc=PAPER):
        ax.add_patch(matplotlib.patches.Ellipse((x, y), 0.25, 0.06, fc=fc, ec=GREEN, lw=1))
        ax.text(x, y, t, ha="center", va="center", fontsize=8.3)

    actor(0.09, 0.62, "Manufacturer /\ndesigner")
    actor(0.91, 0.62, "Supplier /\nwaste producer")
    actor(0.09, 0.18, "Visitor\n(not signed in)")
    left = ["Assess product impact", "View hotspots & alternatives", "Compare & download report", "Browse & compare listings", "Send material request", "Accept quote, place order", "Track order, repeat order"]
    right = ["Register company profile", "Create / edit listings", "Accept / quote / decline", "Confirm & dispatch orders", "View supplier dashboard"]
    for i, t in enumerate(left):
        y = 0.86 - i * 0.105
        case(0.37, y, t)
        ax.plot([0.12, 0.245], [0.64, y], color=MUTED, lw=0.7)
        if i in (0, 1, 2, 3):
            ax.plot([0.12, 0.245], [0.2, y], color=LINE, lw=0.6, ls=":")
    for i, t in enumerate(right):
        y = 0.80 - i * 0.12
        case(0.63, y, t, fc="white")
        ax.plot([0.88, 0.755], [0.64, y], color=MUTED, lw=0.7)
    ax.text(0.5, 0.06, "Dotted lines: visitors can assess products and browse listings without an account.", ha="center", fontsize=8, color=MUTED, style="italic")
    save(fig, "fig_usecase.png")


# ------------------------------------------------------------------ 7. ER diagram
def er():
    fig, ax = canvas(9.5, 5.2)

    def table(x, y, name, cols, w=0.2):
        h = 0.055 + 0.042 * len(cols)
        ax.add_patch(FancyBboxPatch((x, y - h), w, h, boxstyle="round,pad=0.002,rounding_size=0.01", fc="white", ec=GREEN, lw=1.1))
        ax.add_patch(FancyBboxPatch((x, y - 0.055), w, 0.055, boxstyle="round,pad=0.002,rounding_size=0.01", fc=DARK, ec=DARK))
        ax.text(x + w / 2, y - 0.0275, name, ha="center", va="center", color="white", fontsize=9, fontweight="bold")
        for i, c in enumerate(cols):
            ax.text(x + 0.008, y - 0.078 - i * 0.042, c, fontsize=7.6, va="center", color=INK)

    table(0.01, 0.98, "users", ["PK id", "email (unique)", "name, organisation", "role (manufacturer | supplier)", "password_hash, is_demo"])
    table(0.01, 0.42, "auth_tokens", ["PK token_hash", "FK user_id", "expires_at"])
    table(0.27, 0.98, "supplier_profiles", ["PK id", "FK user_id (unique)", "company_name, supplier_type", "city, state, contact", "certifications (JSON)"])
    table(0.53, 0.98, "listings", ["PK id", "FK supplier_id", "title, category, form", "material_id → factor library", "price_per_kg, quality_grade", "available_kg, min_order_kg"], w=0.22)
    table(0.80, 0.98, "assessments", ["PK id", "name, category", "spec, result (JSON)", "recommendations (JSON)"], w=0.19)
    table(0.27, 0.48, "material_requests", ["PK id", "FK manufacturer_id, supplier_id", "FK listing_id", "quantity_kg, status", "quoted_price_per_kg", "repeat_of_request / order", "assessment_id (optional)"], w=0.23)
    table(0.56, 0.48, "orders", ["PK id", "FK request_id (unique)", "FK listing, supplier, manufacturer", "quantity, price, total", "delivery_address, status"], w=0.22)
    table(0.81, 0.48, "order_events", ["PK id", "FK order_id", "status, note", "actor_role, created_at"], w=0.18)

    def link(points, la, pa, lb, pb):
        xs, ys = zip(*points)
        ax.plot(xs, ys, color=GREEN, lw=1.1)
        for text, pos in ((la, pa), (lb, pb)):
            ax.text(pos[0], pos[1], text, fontsize=8.5, color=GREEN, fontweight="bold", ha="center", va="center", bbox=dict(fc="white", ec="none", pad=0.6))

    link([(0.21, 0.90), (0.27, 0.90)], "1", (0.225, 0.925), "0..1", (0.25, 0.875))
    link([(0.08, 0.705), (0.08, 0.42)], "1", (0.065, 0.685), "N", (0.065, 0.44))
    link([(0.47, 0.90), (0.53, 0.90)], "1", (0.485, 0.925), "N", (0.515, 0.875))
    link([(0.21, 0.76), (0.24, 0.76), (0.24, 0.36), (0.27, 0.36)], "1", (0.225, 0.785), "N", (0.255, 0.385))
    link([(0.64, 0.663), (0.64, 0.56), (0.42, 0.56), (0.42, 0.48)], "1", (0.655, 0.645), "N", (0.435, 0.50))
    link([(0.50, 0.33), (0.56, 0.33)], "1", (0.515, 0.355), "0..1", (0.54, 0.305))
    link([(0.78, 0.33), (0.81, 0.33)], "1", (0.79, 0.355), "N", (0.80, 0.305))
    save(fig, "fig_er.png")


# ------------------------------------------------------------------ charts (engine data)
STAGES = [("materials", "Raw materials", DARK), ("manufacturing", "Manufacturing energy", EMERALD), ("packaging", "Packaging", AMBER), ("transport", "Transportation", LIME), ("end_of_life", "End-of-life", SLATE)]
SHORT = {"Single-use plastic water bottle": "PET bottle", "Cotton crew-neck T-shirt": "Cotton T-shirt", "Aluminium laptop stand": "Aluminium stand", "Flat-pack side table": "Side table"}


def chart_stages():
    prods = DATA["products"]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    names = [SHORT[p["name"]] for p in prods]
    left = [0] * len(prods)
    for key, label, color in STAGES:
        vals = [p["shares"][key] for p in prods]
        ax.barh(names, vals, left=left, color=color, label=label, height=0.55)
        for i, v in enumerate(vals):
            if v >= 6:
                ax.text(left[i] + v / 2, i, f"{v:.0f}%", ha="center", va="center", color="white", fontsize=9)
        left = [l + v for l, v in zip(left, vals)]
    ax.set_xlim(0, 100)
    ax.set_xlabel("Share of estimated carbon footprint per unit (%)")
    ax.invert_yaxis()
    ax.legend(ncol=5, fontsize=8.5, loc="upper center", bbox_to_anchor=(0.5, -0.22), frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    save(fig, "chart_stage_shares.png")


def chart_optimised():
    prods = DATA["products"]
    fig, ax = plt.subplots(figsize=(8, 3.6))
    names = [SHORT[p["name"]] for p in prods]
    orig = [p["batch"]["carbon_kg"] / 1000 for p in prods]
    opt = [p["optimized_batch_carbon"] / 1000 for p in prods]
    x = range(len(prods))
    ax.bar([i - 0.2 for i in x], orig, width=0.38, color="#94A3B8", label="Original specification")
    ax.bar([i + 0.2 for i in x], opt, width=0.38, color=EMERALD, label="Optimised (beneficial alternatives applied)")
    for i, (a, b) in enumerate(zip(orig, opt)):
        ax.text(i - 0.2, a, f"{a:.1f}", ha="center", va="bottom", fontsize=9)
        ax.text(i + 0.2, b, f"{b:.1f}\n(−{100 * (1 - b / a):.0f}%)", ha="center", va="bottom", fontsize=8.5)
    ax.set_xticks(list(x), names)
    ax.set_ylabel("Estimated batch footprint (t CO2e)")
    ax.set_ylim(0, max(orig) * 1.2)
    ax.legend(fontsize=9, frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    save(fig, "chart_optimised.png")


def chart_lab():
    lab = DATA["lab"]
    fig, ax = plt.subplots(figsize=(8, 3.4))
    names = [f"{o['label']}\n({o['mass_g']} g)" for o in lab]
    x = range(len(lab))
    ax.bar([i - 0.2 for i in x], [o["grid"] * 1000 for o in lab], width=0.38, color=DARK, label="Grid electricity")
    ax.bar([i + 0.2 for i in x], [o["renew"] * 1000 for o in lab], width=0.38, color=EMERALD, label="Renewable electricity")
    for i, o in enumerate(lab):
        ax.text(i - 0.2, o["grid"] * 1000, f"{o['grid'] * 1000:.0f}", ha="center", va="bottom", fontsize=8.5)
    ax.set_xticks(list(x), names, fontsize=9)
    ax.set_ylabel("g CO2e per 500 ml bottle")
    ax.legend(fontsize=9, frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    save(fig, "chart_material_lab.png")


if __name__ == "__main__":
    for fn in (architecture, workflow, assessment, recommendation, sequence, usecase, er, chart_stages, chart_optimised, chart_lab):
        fn()
    print("figures:", sorted(p.name for p in OUT.iterdir()))

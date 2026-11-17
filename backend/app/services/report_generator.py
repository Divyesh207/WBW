"""PDF environmental screening report (ReportLab).

The official Waste Before Waste logo is drawn as vector geometry taken verbatim
from the brand SVG (96 x 96 viewBox: ring path + decision square), with the
wordmark set in Sora SemiBold at the identity's 52 : 22 : 18 lock-up ratio.
"""
from __future__ import annotations

import io
import math
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"

GREEN = colors.HexColor("#166534")
EMERALD = colors.HexColor("#10B981")
DARK = colors.HexColor("#064E3B")
OFFWHITE = colors.HexColor("#F8FAF7")
HAIRLINE = colors.HexColor("#D5DED2")
INK = colors.HexColor("#14261D")
MUTED = colors.HexColor("#5B6B62")
AMBER = colors.HexColor("#B45309")
STAGE_COLORS = {
    "materials": DARK,
    "manufacturing": EMERALD,
    "packaging": colors.HexColor("#D97706"),
    "transport": colors.HexColor("#84CC16"),
    "end_of_life": colors.HexColor("#64748B"),
}

FONTS = {"display": "Helvetica-Bold", "regular": "Helvetica", "medium": "Helvetica", "semibold": "Helvetica-Bold"}


def _register_fonts() -> None:
    files = {
        "display": ("WBW-Sora-SemiBold", "Sora-SemiBold.ttf"),
        "regular": ("WBW-Inter", "Inter-Regular.ttf"),
        "medium": ("WBW-Inter-Medium", "Inter-Medium.ttf"),
        "semibold": ("WBW-Inter-SemiBold", "Inter-SemiBold.ttf"),
    }
    for key, (name, filename) in files.items():
        path = FONT_DIR / filename
        if path.exists():
            try:
                pdfmetrics.registerFont(TTFont(name, str(path)))
                FONTS[key] = name
            except Exception:  # keep the Helvetica fallback
                pass


_register_fonts()


def fmt(value, unit: str = "") -> str:
    """Format to at most three significant figures."""
    if value is None:
        return "–"
    value = float(value)
    if value == 0:
        text = "0"
    else:
        digits = 2 - int(math.floor(math.log10(abs(value))))
        rounded = round(value, digits)
        text = f"{rounded:,.0f}" if digits <= 0 else f"{rounded:,.{min(digits, 6)}f}".rstrip("0").rstrip(".")
    return f"{text} {unit}".strip()


def pct(value) -> str:
    if value is None:
        return "n/a"
    if abs(value) < 0.5:
        return "no change"
    return f"{value:+.0f}%"


# ---------------------------------------------------------------- brand logo
def draw_symbol(canv, x: float, y: float, size: float, ring=GREEN, square=EMERALD) -> None:
    """Official symbol. SVG: path 'M48 19 A29 29 0 1 1 19 48' stroke 14; rect 12,12 14x14."""
    s = size / 96.0
    canv.saveState()
    canv.setStrokeColor(ring)
    canv.setLineWidth(14 * s)
    canv.setLineCap(0)
    canv.arc(x + 19 * s, y + 19 * s, x + 77 * s, y + 77 * s, startAng=90, extent=-270)
    canv.setFillColor(square)
    canv.rect(x + 12 * s, y + 70 * s, 14 * s, 14 * s, stroke=0, fill=1)
    canv.restoreState()


def draw_logo(canv, x: float, y: float, icon: float, text_color=DARK, ring=GREEN) -> float:
    """Horizontal lock-up; returns its total width."""
    draw_symbol(canv, x, y, icon, ring=ring)
    font_size = icon * 22 / 52
    gap = icon * 18 / 52
    tracking = 0.14 * font_size
    word = "WASTE BEFORE WASTE"
    canv.saveState()
    text = canv.beginText(x + icon + gap, y + icon / 2 - font_size * 0.36)
    text.setFont(FONTS["display"], font_size)
    text.setCharSpace(tracking)
    text.setFillColor(text_color)
    text.textOut(word)
    canv.drawText(text)
    canv.restoreState()
    return icon + gap + pdfmetrics.stringWidth(word, FONTS["display"], font_size) + tracking * len(word)


# ---------------------------------------------------------------- flowables
class StageBars(Flowable):
    """Horizontal bars for carbon by life-cycle stage."""

    def __init__(self, stages: list[dict], width: float):
        super().__init__()
        self.stages = stages
        self.width = width
        self.row = 7 * mm
        self.height = self.row * len(stages)

    def wrap(self, *_):
        return self.width, self.height

    def draw(self):
        c = self.canv
        label_w, value_w = 42 * mm, 34 * mm
        bar_w = self.width - label_w - value_w
        top = max((s["share_pct"] for s in self.stages), default=0) or 1
        for i, stage in enumerate(self.stages):
            y = self.height - (i + 1) * self.row
            c.setFont(FONTS["regular"], 8.5)
            c.setFillColor(INK)
            c.drawString(0, y + 2.2 * mm, stage["label"])
            c.setFillColor(OFFWHITE)
            c.rect(label_w, y + 1.4 * mm, bar_w, 4 * mm, stroke=0, fill=1)
            c.setFillColor(STAGE_COLORS.get(stage["key"], GREEN))
            c.rect(label_w, y + 1.4 * mm, bar_w * stage["share_pct"] / top, 4 * mm, stroke=0, fill=1)
            c.setFillColor(INK)
            c.setFont(FONTS["medium"], 8.5)
            c.drawRightString(self.width, y + 2.2 * mm, f"{fmt(stage['batch_carbon_kg'], 'kg')}  ·  {stage['share_pct']:.0f}%")


class CompareBars(Flowable):
    """Paired original / optimised bars, each metric scaled to its own original value."""

    def __init__(self, metrics: list[dict], width: float):
        super().__init__()
        self.metrics = metrics
        self.width = width
        self.row = 11 * mm
        self.height = self.row * len(metrics)

    def wrap(self, *_):
        return self.width, self.height

    def draw(self):
        c = self.canv
        label_w, value_w = 42 * mm, 40 * mm
        bar_w = self.width - label_w - value_w
        for i, m in enumerate(self.metrics):
            y = self.height - (i + 1) * self.row
            top = max(m["original"], m["optimized"]) or 1
            c.setFont(FONTS["regular"], 8.5)
            c.setFillColor(INK)
            c.drawString(0, y + 5 * mm, m["label"])
            for j, (key, color) in enumerate((("original", colors.HexColor("#94A3B8")), ("optimized", EMERALD))):
                by = y + 5.6 * mm - j * 3.8 * mm
                c.setFillColor(color)
                c.rect(label_w, by, max(bar_w * m[key] / top, 0.6), 3 * mm, stroke=0, fill=1)
                c.setFillColor(INK if j else MUTED)
                c.setFont(FONTS["medium" if j else "regular"], 8)
                c.drawRightString(self.width, by + 0.6 * mm, fmt(m[key], m["unit"]))


# ---------------------------------------------------------------- document
def _styles() -> dict[str, ParagraphStyle]:
    base = dict(fontName=FONTS["regular"], fontSize=9, leading=13, textColor=INK)
    return {
        "body": ParagraphStyle("body", **base),
        "small": ParagraphStyle("small", **{**base, "fontSize": 8, "leading": 11, "textColor": MUTED}),
        "cell": ParagraphStyle("cell", **{**base, "fontSize": 8.5, "leading": 11.5}),
        "cell_r": ParagraphStyle("cell_r", **{**base, "fontSize": 8.5, "leading": 11.5, "alignment": TA_RIGHT}),
        "head": ParagraphStyle("head", **{**base, "fontName": FONTS["semibold"], "fontSize": 7.5, "leading": 10, "textColor": MUTED}),
        "head_r": ParagraphStyle("head_r", **{**base, "fontName": FONTS["semibold"], "fontSize": 7.5, "leading": 10, "textColor": MUTED, "alignment": TA_RIGHT}),
        "title": ParagraphStyle("title", fontName=FONTS["display"], fontSize=20, leading=25, textColor=DARK),
        "h2": ParagraphStyle("h2", fontName=FONTS["display"], fontSize=11.5, leading=15, textColor=DARK, spaceBefore=14, spaceAfter=6),
        "h3": ParagraphStyle("h3", fontName=FONTS["semibold"], fontSize=9.5, leading=13, textColor=INK),
        "eyebrow": ParagraphStyle("eyebrow", fontName=FONTS["medium"], fontSize=7.5, leading=10, textColor=GREEN),
        "kpi": ParagraphStyle("kpi", fontName=FONTS["display"], fontSize=14, leading=18, textColor=DARK),
        "notice": ParagraphStyle("notice", **{**base, "fontSize": 8.5, "leading": 12, "textColor": DARK}),
    }


def _table(rows, col_widths, header=True, align_right_from: int | None = None) -> Table:
    table = Table(rows, colWidths=col_widths, repeatRows=1 if header else 0)
    style = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, HAIRLINE),
    ]
    if header:
        style.append(("LINEBELOW", (0, 0), (-1, 0), 0.8, DARK))
    table.setStyle(TableStyle(style))
    return table


def _labels(reference: dict) -> dict:
    return {
        "material": {m["id"]: m["name"] for m in reference["materials"]},
        "method": {m["id"]: m["name"] for m in reference["manufacturing_methods"]},
        "source": {m["id"]: m["name"] for m in reference["energy_sources"]},
        "mode": {m["id"]: m["name"] for m in reference["transport_modes"]},
        "pack": {m["id"]: m["name"] for m in reference["packaging_options"]},
        "repair": reference["repairability_levels"],
        "use": reference["use_types"],
    }


def build_pdf(assessment: dict, reference: dict) -> bytes:
    st = _styles()
    spec, result = assessment["spec"], assessment["result"]
    optimized, comparison = assessment["optimized_result"], assessment["comparison"]
    recs = assessment["recommendations"]
    selected = set(assessment["selected_ids"])
    names = _labels(reference)
    created = datetime.fromisoformat(assessment["created_at"]).strftime("%d %B %Y")
    buffer = io.BytesIO()
    page_w, page_h = A4
    margin = 18 * mm
    width = page_w - 2 * margin

    def decorate(canv, doc):
        canv.saveState()
        draw_logo(canv, margin, page_h - 19 * mm, 8.5 * mm)
        canv.setFont(FONTS["medium"], 7.5)
        canv.setFillColor(MUTED)
        canv.drawRightString(page_w - margin, page_h - 15.6 * mm, "ENVIRONMENTAL SCREENING REPORT")
        canv.setStrokeColor(HAIRLINE)
        canv.setLineWidth(0.6)
        canv.line(margin, page_h - 23 * mm, page_w - margin, page_h - 23 * mm)
        canv.line(margin, 14 * mm, page_w - margin, 14 * mm)
        canv.setFont(FONTS["regular"], 7)
        canv.drawString(margin, 10 * mm, "Preliminary screening with illustrative factors — estimates only, not a certified ISO 14040/14044 LCA.")
        canv.drawRightString(page_w - margin, 10 * mm, f"Page {doc.page}")
        canv.restoreState()

    doc = BaseDocTemplate(
        buffer, pagesize=A4, leftMargin=margin, rightMargin=margin, topMargin=28 * mm, bottomMargin=18 * mm,
        title=f"{assessment['name']} — Environmental Screening Report", author="Waste Before Waste",
    )
    doc.addPageTemplates(PageTemplate(id="main", frames=[Frame(margin, 18 * mm, width, page_h - 46 * mm, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)], onPage=decorate))

    P = Paragraph
    story: list = []

    # ---- Title -------------------------------------------------------------
    story += [
        P("THINK BEFORE YOU MANUFACTURE.", st["eyebrow"]),
        Spacer(1, 3),
        P(assessment["name"], st["title"]),
        Spacer(1, 2),
        P(f"{assessment['category']} · Assessment #{assessment['id']} · {created}" + (" · Demonstration data" if assessment["is_demo"] else ""), st["small"]),
        Spacer(1, 8),
    ]
    notice = Table([[P(result["disclaimer"], st["notice"])]], colWidths=[width])
    notice.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), OFFWHITE), ("LINEBEFORE", (0, 0), (0, -1), 2, EMERALD), ("LEFTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7)]))
    story.append(notice)

    # ---- Summary -----------------------------------------------------------
    pu, batch, dq = result["per_unit"], result["batch"], result["data_quality"]
    story.append(P("Assessment summary", st["h2"]))
    kpis = [
        ("CARBON / UNIT", fmt(pu["carbon_kg"], "kg CO2e"), f"Estimated; range {fmt(pu['carbon_low_kg'])}–{fmt(pu['carbon_high_kg'])}"),
        ("CARBON / BATCH", fmt(batch["carbon_kg"], "kg CO2e"), f"Estimated; {spec['production_quantity']:,} units"),
        ("ENERGY / BATCH", fmt(batch["energy_kwh"], "kWh"), "Estimated; process + embodied"),
        ("WATER / BATCH", fmt(batch["water_l"], "L"), "Estimated; process + embodied"),
    ]
    kpi_table = Table([[[P(a, st["head"]), Spacer(1, 2), P(b, st["kpi"]), P(c, st["small"])] for a, b, c in kpis]], colWidths=[width / 4] * 4)
    kpi_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 8), ("LINEBEFORE", (0, 0), (-1, -1), 0.6, HAIRLINE), ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2)]))
    story += [kpi_table, Spacer(1, 6)]
    story.append(P(f"<b>Data quality: {dq['rating']} ({dq['score']} of {dq['max_score']})</b> · factor uncertainty about ±{dq['uncertainty_pct']}%. Electricity, process water and masses are as entered by the user; every impact figure is an estimate.", st["body"]))

    # ---- Product information ----------------------------------------------
    mfg, pack, eol = spec["manufacturing"], spec["packaging"], spec["end_of_life"]
    circ = result["circularity"]
    info = [
        ("Product", spec["name"]), ("Category", spec["category"]),
        ("Description", spec["description"] or "–"),
        ("Production quantity", f"{spec['production_quantity']:,} units"),
        ("Product weight", fmt(spec["product_weight_kg"], "kg")),
        ("Expected lifespan", f"{spec['lifespan_years']:g} years"),
        ("Use", names["use"][eol["use_type"]]),
        ("Repairability", names["repair"][eol["repairability"]]),
        ("Recyclability / disposal", f"{circ['recyclability_label']} / {circ['disposal_label']}"),
    ]
    story.append(P("Product information", st["h2"]))
    story.append(_table([[P(a, st["small"]), P(str(b), st["cell"])] for a, b in info], [45 * mm, width - 45 * mm], header=False))

    # ---- Impact breakdown --------------------------------------------------
    story.append(P("Environmental impact breakdown", st["h2"]))
    story.append(P("Estimated carbon footprint by life-cycle stage, whole batch (kg CO2e).", st["small"]))
    story += [Spacer(1, 4), StageBars(result["stages"], width), Spacer(1, 4)]
    story.append(P(f"<b>System boundary.</b> {result['boundary']}", st["small"]))

    # ---- Materials ---------------------------------------------------------
    story.append(P("Material analysis", st["h2"]))
    rows = [[P("MATERIAL", st["head"]), P("IN PRODUCT", st["head_r"]), P("GROSS INPUT", st["head_r"]), P("FACTOR", st["head_r"]), P("CARBON / UNIT", st["head_r"]), P("SHARE", st["head_r"])]]
    for m in result["materials"]:
        rows.append([P(f"{m['name']}<br/><font color='#5B6B62' size='7.5'>{m['family']}</font>", st["cell"]), P(fmt(m["net_kg"], "kg"), st["cell_r"]), P(fmt(m["gross_kg"], "kg"), st["cell_r"]), P(f"{m['emission_factor']:g} kg/kg", st["cell_r"]), P(fmt(m["carbon_kg"], "kg"), st["cell_r"]), P(f"{m['share_carbon_pct']:.0f}%", st["cell_r"])])
    story.append(_table(rows, [width - 5 * 24 * mm] + [24 * mm] * 5))
    story.append(Spacer(1, 3))
    story.append(P(f"Recycled content {circ['recycled_content_pct']:.0f}% · renewable content {circ['renewable_content_pct']:.0f}% by mass. Gross input includes manufacturing scrap. Factors are illustrative.", st["small"]))

    # ---- Manufacturing -----------------------------------------------------
    bench = result["benchmarks"]
    story.append(P("Manufacturing analysis", st["h2"]))
    mrows = [
        ("Method", names["method"][mfg["method"]], ""),
        ("Electricity per unit", fmt(mfg["energy_kwh_per_unit"], "kWh"), "User-provided"),
        ("Energy intensity", f"{fmt(bench['energy_kwh_per_kg'], 'kWh/kg')} ({bench['energy_ratio']:.1f}x indicative benchmark of {bench['typical_energy_kwh_per_kg']} kWh/kg)", "Calculated"),
        ("Energy source", names["source"][mfg["energy_source"]], ""),
        ("Process water per unit", fmt(mfg["water_l_per_unit"], "L"), "User-provided"),
        ("Scrap rate", f"{mfg['waste_pct']:g}% (indicative benchmark {bench['typical_waste_pct']}%)", "User-provided"),
        ("Manufacturing waste, batch", fmt(batch["waste_kg"], "kg"), "Calculated"),
        ("Transport", f"{mfg['transport_distance_km']:,.0f} km by {names['mode'][mfg['transport_mode']].lower()}", "User-provided"),
        ("Packaging", f"{names['pack'][pack['material']]}, {fmt(pack['weight_kg'] * 1000, 'g')} per unit", "User-provided"),
    ]
    story.append(_table([[P(a, st["small"]), P(b, st["cell"]), P(c, st["small"])] for a, b, c in mrows], [45 * mm, width - 73 * mm, 28 * mm], header=False))

    # ---- Energy and water --------------------------------------------------
    story.append(P("Water and energy consumption", st["h2"]))
    rows = [[P("INDICATOR (WHOLE BATCH)", st["head"]), P("PROCESS (ENTERED)", st["head_r"]), P("EMBODIED (ESTIMATED)", st["head_r"]), P("TOTAL", st["head_r"])],
            [P("Energy", st["cell"]), P(fmt(batch["process_energy_kwh"], "kWh"), st["cell_r"]), P(fmt(batch["embodied_energy_kwh"], "kWh"), st["cell_r"]), P(fmt(batch["energy_kwh"], "kWh"), st["cell_r"])],
            [P("Water", st["cell"]), P(fmt(batch["process_water_l"], "L"), st["cell_r"]), P(fmt(batch["embodied_water_l"], "L"), st["cell_r"]), P(fmt(batch["water_l"], "L"), st["cell_r"])]]
    story.append(_table(rows, [width - 3 * 38 * mm] + [38 * mm] * 3))

    # ---- Hotspots ----------------------------------------------------------
    story.append(P("Identified environmental hotspots", st["h2"]))
    for h in result["hotspots"]:
        tone = "#B45309" if h["severity"] == "high" else "#166534"
        story.append(P(f"<font color='{tone}'><b>{h['severity'].upper()}</b></font> · <b>{h['area']}</b> ({h['indicator']}) — {h['detail']}", st["body"]))
        story.append(Spacer(1, 3))

    # ---- Recommendations ---------------------------------------------------
    story.append(P("Recommended alternatives", st["h2"]))
    verdicts = {"beneficial": "Improves this product", "mixed": "Mixed result — review trade-offs", "advisory": "Design advice — not quantified", "not_beneficial": "No improvement for this product"}
    if not recs:
        story.append(P("No rule-based recommendations were triggered for this specification.", st["body"]))
    for r in recs:
        applied = " · <font color='#166534'><b>Applied in optimised scenario</b></font>" if r["id"] in selected else ""
        block = [
            P(r["title"], st["h3"]),
            P(f"{r['category']} · {verdicts[r['verdict']]} · Feasibility: {r['feasibility']}{applied}", st["small"]),
            Spacer(1, 2),
            _table(
                [[P(a, st["small"]), P(b, st["cell"])] for a, b in [
                    ("Current situation", r["current_situation"]),
                    ("Suggested alternative", r["suggested_alternative"]),
                    ("Estimated benefit", r["estimated_benefit"]),
                    ("Cost implications", r["cost_implications"]),
                    ("Feasibility", f"{r['feasibility']} — {r['feasibility_note']}"),
                    ("Trade-offs and limits", "<br/>".join(f"• {t}" for t in r["trade_offs"])),
                ]],
                [38 * mm, width - 38 * mm], header=False,
            ),
            Spacer(1, 9),
        ]
        story.append(KeepTogether(block))

    # ---- Comparison --------------------------------------------------------
    story.append(P("Original vs. optimised product", st["h2"]))
    if selected:
        summary = comparison["summary"]
        story.append(P(f"With {len(selected)} recommendation(s) applied, the estimated batch carbon footprint changes by <b>{pct(summary['carbon_change_pct'])}</b>. Both products use the same boundary and factors; differences are modelled estimates, not verified reductions.", st["body"]))
        story += [Spacer(1, 6), CompareBars(comparison["metrics"], width), Spacer(1, 6)]
        rows = [[P("INDICATOR (WHOLE BATCH)", st["head"]), P("ORIGINAL", st["head_r"]), P("OPTIMISED", st["head_r"]), P("CHANGE", st["head_r"])]]
        for m in comparison["metrics"]:
            rows.append([P(m["label"], st["cell"]), P(fmt(m["original"], m["unit"]), st["cell_r"]), P(fmt(m["optimized"], m["unit"]), st["cell_r"]), P(pct(m["change_pct"]), st["cell_r"])])
        for m in comparison["circularity"]:
            rows.append([P(m["label"], st["cell"]), P(m["original"], st["cell_r"]), P(m["optimized"], st["cell_r"]), P(m["direction"].capitalize(), st["cell_r"])])
        story.append(_table(rows, [width - 3 * 40 * mm] + [40 * mm] * 3))
        if optimized["warnings"]:
            story.append(P(" ".join(optimized["warnings"]), st["small"]))
    else:
        story.append(P("No recommendations are applied, so the optimised product is identical to the original.", st["body"]))

    # ---- Assumptions -------------------------------------------------------
    story.append(P("Assumptions and limitations", st["h2"]))
    for a in result["assumptions"]:
        story.append(P(f"• {a}", st["body"]))
    story.append(P("Data-quality indicator", st["h2"]))
    story.append(P(f"<b>{dq['rating']} — level {dq['score']} of {dq['max_score']}</b>, factor uncertainty about ±{dq['uncertainty_pct']}%.", st["body"]))
    for n in dq["notes"]:
        story.append(P(f"• {n}", st["body"]))
    story.append(P("Factors used", st["h2"]))
    rows = [[P("FACTOR", st["head"]), P("VALUE", st["head_r"]), P("ASSUMED BASIS", st["head"])]]
    for f in result["factors_used"]:
        rows.append([P(f["name"], st["cell"]), P(f"{f['value']:g} {f['unit']}", st["cell_r"]), P(f["basis"], st["small"])])
    story.append(_table(rows, [50 * mm, 42 * mm, width - 92 * mm]))

    doc.build(story)
    return buffer.getvalue()

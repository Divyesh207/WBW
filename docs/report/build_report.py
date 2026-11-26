"""Builds the Waste Before Waste project report (DOCX).

Run from the repository root:  python docs/report/build_report.py
Then docs/report/export_pdf.py updates the table of contents and exports the PDF.

Formatting follows the faculty brief: Times New Roman 12 pt, double-spaced
body text, 1-inch margins, 0.5-inch first-line indents, page numbers bottom
centre, Chicago author-date citations. Tables, captions and figures are set
smaller and single-spaced, as Chicago allows, and are excluded from the line count.
"""
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

HERE = Path(__file__).resolve().parent
IMG = HERE / "images"
FIG = IMG / "figures"
OUT = HERE / "Waste_Before_Waste_Project_Report.docx"
FONT = "Times New Roman"

doc = Document()

# ------------------------------------------------------------------ page setup and styles
sec = doc.sections[0]
sec.page_height, sec.page_width = Inches(11.69), Inches(8.27)  # A4
for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
    setattr(sec, side, Inches(1))


def set_font(style_or_run, size=12, bold=None, italic=None, color=None):
    f = style_or_run.font
    f.name = FONT
    f.size = Pt(size)
    if bold is not None:
        f.bold = bold
    if italic is not None:
        f.italic = italic
    f.color.rgb = color or RGBColor(0, 0, 0)
    el = style_or_run.element if hasattr(style_or_run, "element") else style_or_run._element
    rpr = el.get_or_add_rPr()
    rfonts = rpr.find(qn("w:rFonts"))
    if rfonts is None:
        rfonts = OxmlElement("w:rFonts")
        rpr.append(rfonts)
    for attr in ("w:ascii", "w:hAnsi", "w:eastAsia", "w:cs"):
        rfonts.set(qn(attr), FONT)
    for attr in ("w:asciiTheme", "w:hAnsiTheme", "w:eastAsiaTheme", "w:cstheme"):
        if rfonts.get(qn(attr)) is not None:
            del rfonts.attrib[qn(attr)]


normal = doc.styles["Normal"]
set_font(normal)
lang = OxmlElement("w:lang")
lang.set(qn("w:val"), "en-GB")
normal.element.get_or_add_rPr().append(lang)
pf = normal.paragraph_format
pf.line_spacing_rule = WD_LINE_SPACING.DOUBLE
pf.space_before = Pt(0)
pf.space_after = Pt(0)
pf.first_line_indent = Inches(0.5)
pf.widow_control = True

for name, size in (("Heading 1", 14), ("Heading 2", 12), ("Title", 20)):
    st = doc.styles[name]
    set_font(st, size=size, bold=True)
    st.paragraph_format.first_line_indent = Inches(0)
    st.paragraph_format.line_spacing_rule = WD_LINE_SPACING.DOUBLE
    st.paragraph_format.space_before = Pt(6 if name != "Heading 2" else 0)
    st.paragraph_format.space_after = Pt(0)
    st.paragraph_format.keep_with_next = True
doc.styles["Heading 2"].font.italic = False

cap = doc.styles.add_style("FigCaption", 1)
set_font(cap, size=10, italic=False)
cap.paragraph_format.first_line_indent = Inches(0)
cap.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
cap.paragraph_format.space_before = Pt(4)
cap.paragraph_format.space_after = Pt(10)
cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER

tbl = doc.styles.add_style("TableText", 1)
set_font(tbl, size=10)
tbl.paragraph_format.first_line_indent = Inches(0)
tbl.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
tbl.paragraph_format.space_after = Pt(0)

for level in (1, 2):
    try:
        toc_style = doc.styles[f"TOC {level}"]
    except KeyError:
        toc_style = doc.styles.add_style(f"TOC {level}", 1)
    set_font(toc_style, size=12)
    toc_style.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    toc_style.paragraph_format.first_line_indent = Inches(0)
    toc_style.paragraph_format.left_indent = Inches(0.3 * (level - 1))
    toc_style.paragraph_format.space_after = Pt(4 if level == 1 else 2)

counters = {"fig": 0, "tab": 0}


# ------------------------------------------------------------------ helpers
def add_runs(p, text):
    """Very small markup: **bold** and *italic*."""
    import re

    for part in re.split(r"(\*\*[^*]+\*\*|\*[^*]+\*)", text):
        if not part:
            continue
        if part.startswith("**"):
            r = p.add_run(part[2:-2])
            r.bold = True
        elif part.startswith("*"):
            r = p.add_run(part[1:-1])
            r.italic = True
        else:
            r = p.add_run(part)
        set_font(r, size=p.style.font.size.pt if p.style.font.size else 12, bold=r.bold, italic=r.italic)


def para(text, indent=True, align=None, style=None):
    p = doc.add_paragraph(style=style)
    if not indent:
        p.paragraph_format.first_line_indent = Inches(0)
    if align:
        p.alignment = align
    add_runs(p, text)
    return p


def bullets(items, numbered=False):
    for i, item in enumerate(items, 1):
        p = doc.add_paragraph()
        p.paragraph_format.first_line_indent = Inches(-0.25)
        p.paragraph_format.left_indent = Inches(0.75)
        add_runs(p, (f"{i}.\t" if numbered else "•\t") + item)
        p.paragraph_format.tab_stops.add_tab_stop(Inches(0.75))


def formula(text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Inches(0)
    r = p.add_run(text)
    set_font(r, italic=True)


def h1(text):
    doc.add_heading(text, level=1)


def h2(text):
    doc.add_heading(text, level=2)


def caption(text, kind="fig"):
    counters[kind] += 1
    label = "Figure" if kind == "fig" else "Table"
    p = doc.add_paragraph(style="FigCaption")
    r = p.add_run(f"{label} {counters[kind]}. ")
    set_font(r, size=10, bold=True)
    add_runs(p, text)
    if kind == "tab":
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.space_after = Pt(4)
    return counters[kind]


def figure(path, width, text):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Inches(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    p.paragraph_format.keep_with_next = True
    p.add_run().add_picture(str(path), width=Inches(width))
    return caption(text)


def grid(paths, labels, text, cols=2, width=3.05):
    rows = (len(paths) + cols - 1) // cols
    t = doc.add_table(rows=rows * 2, cols=cols)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (path, label) in enumerate(zip(paths, labels)):
        r, c = divmod(i, cols)
        cell = t.cell(r * 2, c)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.style = doc.styles["TableText"]
        p.add_run().add_picture(str(path), width=Inches(width))
        lp = t.cell(r * 2 + 1, c).paragraphs[0]
        lp.style = doc.styles["TableText"]
        lp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_runs(lp, label)
        lp.paragraph_format.space_after = Pt(4)
    keep_together(t, last_too=True)
    return caption(text)


def keep_together(t, last_too=False):
    """Rows never split, and every row stays on the page of the next one."""
    rows = list(t.rows)
    for i, row in enumerate(rows):
        row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
        if i < len(rows) - 1 or last_too:
            for cell in row.cells:
                for cp in cell.paragraphs:
                    cp.paragraph_format.keep_with_next = True


def shade(cell, hex_color):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_color)
    tc_pr.append(shd)


def table(header, rows, widths, text):
    caption(text, "tab")
    t = doc.add_table(rows=1 + len(rows), cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r_i, values in enumerate([header] + rows):
        for c_i, value in enumerate(values):
            cell = t.cell(r_i, c_i)
            cell.width = Inches(widths[c_i])
            p = cell.paragraphs[0]
            p.style = doc.styles["TableText"]
            add_runs(p, f"**{value}**" if r_i == 0 else str(value))
            if r_i == 0:
                shade(cell, "DCEFE3")
    keep_together(t)
    spacer = doc.add_paragraph(style="TableText")
    spacer.paragraph_format.space_after = Pt(6)
    return counters["tab"]


def page_break():
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)


def field(paragraph, code):
    r = paragraph.add_run()
    b = OxmlElement("w:fldChar")
    b.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = code
    sep = OxmlElement("w:fldChar")
    sep.set(qn("w:fldCharType"), "separate")
    txt = OxmlElement("w:t")
    txt.text = "Right-click and choose Update Field to build the table of contents."
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    for el in (b, instr, sep, txt, end):
        r._r.append(el)
    set_font(r)


# ------------------------------------------------------------------ cover page
def center(text, size=12, bold=False, italic=False, space_after=0, color=None):
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.first_line_indent = Inches(0)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    p.paragraph_format.space_after = Pt(space_after)
    r = p.add_run(text)
    set_font(r, size=size, bold=bold, italic=italic, color=color)
    return p


center("D. Y. Patil College of Engineering, Akurdi, Pune", 14, bold=True, space_after=4)
center("Department of [Department Name]", 12, space_after=4)
center("Sustainability Project Report (CCE4)", 12, italic=True, space_after=48)
logo = doc.add_paragraph()
logo.alignment = WD_ALIGN_PARAGRAPH.CENTER
logo.paragraph_format.first_line_indent = Inches(0)
logo.add_run().add_picture(str(IMG / "figures" / "cover_logo.png"), width=Inches(1.3))
center("WASTE BEFORE WASTE", 24, bold=True, space_after=6, color=RGBColor(0x06, 0x4E, 0x3B))
center("A Pre-Manufacturing Environmental Impact Assessment and", 14, space_after=2)
center("Sustainable Material Sourcing Platform", 14, space_after=14)
center("Think Before You Manufacture.", 12, italic=True, space_after=60)
center("Aligned with UN Sustainable Development Goals 12, 9 and 13", 12, space_after=60)
center("Submitted by: [Team / Group Number]", 12, space_after=4)
center("Class / Division: [Class and Division]", 12, space_after=4)
center("Under the guidance of: [Guide Name]", 12, space_after=4)
center("Academic Year: [20XX–20XX]", 12, space_after=0)

# body section with page numbers bottom centre (cover stays unnumbered)
new = doc.add_section(WD_SECTION.NEW_PAGE)
new.footer.is_linked_to_previous = False
fp = new.footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
fp.paragraph_format.first_line_indent = Inches(0)
field(fp, "PAGE")
fp.runs[0]._r.findall(qn("w:t"))[0].text = "1"
pg = new._sectPr.find(qn("w:pgNumType"))
if pg is None:
    pg = OxmlElement("w:pgNumType")
    new._sectPr.append(pg)
pg.set(qn("w:start"), "1")
sec.footer.is_linked_to_previous = False

# ------------------------------------------------------------------ team, abstract, index
h1("Team Member Details")
table(
    ["Sr. No.", "Name of Student", "Roll Number", "Project Role"],
    [["1", "[Student Name]", "[Roll No.]", "[e.g. Project lead, backend and assessment engine]"],
     ["2", "[Student Name]", "[Roll No.]", "[e.g. Frontend and user interface]"],
     ["3", "[Student Name]", "[Roll No.]", "[e.g. Supplier Marketplace and database]"],
     ["4", "[Student Name]", "[Roll No.]", "[e.g. Research, testing and documentation]"]],
    [0.6, 1.9, 1.2, 2.6],
    "Team members and project roles (add or remove rows to match the group).",
)

h1("Abstract")
para(
    "Waste Before Waste is a web-based platform that helps manufacturers make environmentally responsible decisions before production begins. "
    "Most industries manage waste after it has been created, although many of a product's environmental consequences are fixed earlier, when its materials, "
    "processes and packaging are chosen. The platform lets a user enter a product's raw materials, manufacturing process, energy and water use, packaging, "
    "transport and expected end-of-life. A rule-based assessment engine then estimates the product's carbon footprint, energy and water demand, raw material "
    "consumption and manufacturing waste across five life-cycle stages, identifies hotspots, and proposes alternatives such as recycled materials, renewable "
    "electricity or reduced scrap. Every alternative is recalculated with the same engine and labelled beneficial, mixed or advisory, so that no option is "
    "assumed to be better. A Supplier Marketplace then connects manufacturers with recyclers, waste producers and sustainable material suppliers, allowing "
    "them to compare listings by price, quality, quantity and availability, send material requests, receive quotes, place and track orders, and repeat "
    "previous orders. The prototype is implemented with React, FastAPI and SQLite and passes 58 automated tests. Its results are screening estimates based "
    "largely on illustrative factors, not a certified life cycle assessment. The project supports SDG 12, SDG 9 and SDG 13 by moving waste prevention to the "
    "design stage.",
    indent=False,
)

idx = doc.add_paragraph()
idx.paragraph_format.page_break_before = True
idx.paragraph_format.first_line_indent = Inches(0)
idx.paragraph_format.keep_with_next = True
r_idx = idx.add_run("Index")
set_font(r_idx, size=14, bold=True)
toc = doc.add_paragraph()
toc.paragraph_format.first_line_indent = Inches(0)
field(toc, 'TOC \\o "1-2" \\h \\z \\u')
page_break()

# ------------------------------------------------------------------ 1. introduction
h1("1. Introduction")
para(
    "Waste management and environmental protection are major concerns for modern industry. The world generated about 2.01 billion tonnes of "
    "municipal solid waste in 2016, and this could reach 3.40 billion tonnes by 2050 (Kaza et al. 2018). Most industries respond after production, "
    "through collection, recycling and disposal. These activities deal with waste that already exists, yet the waste hierarchy places prevention first "
    "(European Parliament and Council 2008), and the choices made while a product is still being designed largely decide how much waste it will cause "
    "(Ceschin and Gaziulusoy 2016)."
)
para(
    "Waste Before Waste is a website built on this idea. It helps manufacturers, designers and businesses estimate the environmental impact of a product "
    "before it is made, compare it with improved alternatives, and source the better materials from recyclers, waste producers and sustainable material "
    "suppliers. Its tagline, “Think Before You Manufacture,” summarises the aim: to make waste prevention part of everyday design decisions. "
    "This report separates functionality that has been implemented and tested from functionality that is only proposed."
)

# ------------------------------------------------------------------ 2. background / problem statement
h1("2. Background / Problem Statement")
h2("2.1 Background")
para(
    "Life Cycle Assessment (LCA) measures a product's environmental impact from raw material to disposal and is defined in ISO 14040 and ISO 14044 "
    "(ISO 2006a; 2006b). A full LCA needs experts, licensed data and time, so small manufacturers rarely have one when choosing materials. Meanwhile, the "
    "circular economy and industrial symbiosis encourage using one industry's waste as another's raw material (Ellen MacArthur Foundation 2013; Chertow 2000), "
    "but manufacturers often do not know who supplies such materials, at what price, quality or quantity."
)
h2("2.2 Problem Statement")
para(
    "Many manufacturers think about waste only after production. They are often unaware of eco-friendly raw materials and better manufacturing methods, "
    "find it hard to understand their products' environmental impact, and struggle to find suppliers of alternative materials. As a result, useful waste "
    "materials are not reused and natural resources are wasted. A common platform is needed that shows a product's impact, suggests better materials and "
    "methods, and connects manufacturers with suitable suppliers before manufacturing starts."
)
h2("2.3 Objectives")
bullets(
    [
        "To help manufacturers find suitable, eco-friendly alternative raw materials.",
        "To check products' environmental impact and suggest better materials and methods to reduce waste.",
        "To connect manufacturers with waste producers and suppliers through a common platform.",
        "To let users compare material prices, quality, quantity and availability, and manage requests and repeat orders.",
        "To encourage waste reuse, save natural resources and promote responsible manufacturing.",
    ],
    numbered=True,
)

# ------------------------------------------------------------------ 3. hypothesis / proposal
h1("3. Hypothesis / Proposal")
para(
    "**Hypothesis.** A transparent screening tool used at the design stage can show which decisions drive most of a product's impact and which "
    "alternatives reduce it, and linking those recommendations to suppliers makes the better choice easier to act on. The first part is demonstrated "
    "with the prototype's calculations; its effect on real purchasing decisions has not yet been tested with industrial users."
)
para(
    "**Proposal.** One web platform with two linked modules. The **environmental assessment module** estimates a product's impact, finds hotspots, "
    "tests alternatives and produces a report. The **Supplier Marketplace** lets suppliers list recycled, waste-based and bio-based materials and lets "
    "manufacturers compare listings, request materials, accept quotes, and place, track and repeat orders. When the engine recommends a different "
    "material, the user can open the marketplace filtered to suppliers of that material."
)
h2("3.1 Alignment with the Sustainable Development Goals")
table(
    ["Goal", "Relevant target", "How the platform contributes"],
    [
        ["SDG 12: Responsible Consumption and Production (primary)", "12.2 sustainable use of resources; 12.5 reduce waste through prevention, recycling and reuse",
         "Tests material, scrap and packaging choices before production; recommends recycled materials; creates demand for recycled and waste-based materials."],
        ["SDG 9: Industry, Innovation and Infrastructure", "9.4 upgrade industries for resource efficiency and clean technologies",
         "Gives small manufacturers a free decision tool; flags energy use and scrap above typical values; links industries that can exchange materials."],
        ["SDG 13: Climate Action", "13.3 improve awareness and capacity on climate mitigation",
         "Shows the estimated carbon footprint of each design option at the stage where changing it is cheapest."],
    ],
    [1.6, 2.0, 2.7],
    "Alignment of the platform with UN Sustainable Development Goals (United Nations 2015).",
)
para(
    "The project provides information and connections that make better decisions possible; it does not claim measured environmental improvements."
)

# ------------------------------------------------------------------ 4. design and construction
h1("4. Design & Construction")
para(
    "The prototype is a working web application that runs without paid services or API keys. It uses React 18, TypeScript and Tailwind CSS for the "
    "interface, Recharts and Three.js for charts and the 3D landing page, Python with FastAPI and Pydantic for the server, SQLite with SQLAlchemy for "
    "storage, JSON files for environmental factors, ReportLab for PDF reports and pytest for automated testing."
)
h2("4.1 System Architecture")
fig_arch = figure(FIG / "fig_architecture.png", 5.3, "Three-tier system architecture of the platform.")
para(
    f"The platform has three tiers (Figure {fig_arch}). The React application talks to a FastAPI server through a JSON REST interface. The server keeps "
    "its logic in separate services: assessment, recommendation and comparison engines, a PDF report generator, an authentication service and a "
    "marketplace service. Data is held in SQLite and in JSON factor files, so a licensed LCA database could later replace the factors without changing code."
)
h2("4.2 Modules")
para(
    "**Assessment module.** The assessment engine calculates impacts; the recommendation engine proposes alternatives such as recycled materials, "
    "renewable electricity, less scrap, a different transport mode or lighter packaging; and the comparison engine recalculates the product with the "
    "chosen alternatives. The factor library holds fourteen materials, eight electricity sources, fourteen processes, four transport modes and eight "
    "packaging types. Five electricity factors are published IPCC medians (Schlömer et al. 2014); all others are illustrative and labelled as such."
)
para(
    "**Supplier Marketplace.** Users register as manufacturers or suppliers. Suppliers manage a profile and listings (price per kg, quality grade, recycled "
    "content, stock, minimum order, lead time), answer requests and move orders through confirmation, dispatch and delivery. Placing an order reserves "
    "stock and cancelling returns it. Every order change is logged as a tracking event. Passwords are stored as salted PBKDF2 hashes, and every endpoint "
    "checks the user's role and ownership, so a supplier can never see another supplier's orders. All inputs are validated, with clear error messages."
)
h2("4.3 Database Design")
fig_er = figure(FIG / "fig_er.png", 5.4, "Entity relationship diagram of the implemented database.")
para(
    f"Figure {fig_er} shows the database. Assessments store each specification with its results. The marketplace uses seven tables: a supplier profile "
    "belongs to one user, a supplier has many listings, a request refers to one listing and leads to at most one order, and an order has many events. "
    "A request can also point to the order it repeats and the assessment that prompted it."
)
h2("4.4 User Interface")
fig_screens = grid(
    [IMG / "landing_story.jpg", IMG / "assessment_results.jpg", IMG / "alternatives.jpg", IMG / "compare.jpg", IMG / "supplier_respond.jpg", IMG / "order_tracking.jpg"],
    ["(a) 3D landing page: footprint shown as dots", "(b) Impact results and hotspots", "(c) Recalculated alternatives with supplier link",
     "(d) Comparing supplier listings", "(e) Supplier answering a request with a quote", "(f) Order tracking history"],
    "Screens of the implemented platform (suppliers and prices are fictional demonstration data).",
    width=2.95,
)
para(
    f"Figure {fig_screens} shows the main screens. A five-step wizard collects the product details; the results page shows the footprint with its "
    "uncertainty range and hotspots; and material recommendations carry a button that opens the marketplace. The comparison page highlights the best "
    "listing in each row, suppliers reply to requests with quotes, and both sides follow each order on a timeline."
)

# ------------------------------------------------------------------ 5. working principle
h1("5. Working Principle")
fig_flow = figure(FIG / "fig_workflow.png", 5.4, "Overall workflow of the platform.")
para(
    f"Figure {fig_flow} summarises the workflow. The user describes the product; the engine estimates its impact, finds hotspots and tests alternatives; "
    "the user applies the chosen alternatives, compares and downloads a report; and, if a different material is recommended, sources it in the marketplace."
)
h2("5.1 Environmental Impact Calculation")
para(
    "The engine multiplies each input by a factor and adds five life-cycle stages for one finished unit; batch results multiply by the production "
    "quantity. Material masses are increased to include manufacturing scrap:"
)
formula("Raw materials = Σ [ mass ÷ (1 − scrap rate) ] × material emission factor")
formula("Manufacturing = electricity per unit × electricity factor;   Packaging = packaging mass × packaging factor")
formula("Transport = (product + packaging mass) ÷ 1000 × distance × transport factor")
formula("End-of-life = Σ mass × disposal factor;   Total = sum of the five stages")
para(
    "Energy, water, material use and waste are calculated from the same inputs. Recycling earns no end-of-life credit, so recycled content is not "
    "counted twice. Each result has an uncertainty range and a data-quality rating that stays “low” while factors are generic. Table 2 shows "
    "the calculation for the demonstration product, a 25 g virgin-PET bottle."
)
table(
    ["Stage", "Calculation (per bottle)", "kg CO2e", "Share"],
    [
        ["Raw materials", "0.025 kg ÷ (1 − 0.03) × 3.0", "0.0773", "72%"],
        ["Manufacturing energy", "0.035 kWh × 0.48", "0.0168", "16%"],
        ["Packaging", "0.004 kg × 2.6", "0.0104", "10%"],
        ["Transport", "(0.025 + 0.004) ÷ 1000 × 400 km × 0.10", "0.0012", "1%"],
        ["End-of-life (landfill)", "0.029 kg × 0.05", "0.0015", "1%"],
        ["**Total**", "Range ±30% (0.076–0.139 kg)", "**0.107**", "100%"],
    ],
    [1.5, 2.8, 0.9, 0.7],
    "Worked carbon calculation for the demonstration bottle (illustrative factors; model estimate).",
)
para(
    "For 10,000 bottles this is about 1,071 kg of CO2e, mostly from raw materials. It is a screening estimate for comparing options, not a measured value."
)
h2("5.2 Recommendation Logic")
fig_rec = figure(FIG / "fig_recommendation_flow.png", 5.2, "How alternatives are generated, tested and classified.")
para(
    f"Rules trigger alternatives (Figure {fig_rec}): for example, a material forming at least ten percent of the product with a recycled equivalent "
    "triggers a material swap. Each proposal is applied to a copy of the specification and recalculated. It is **beneficial** if at least one of five "
    "indicators improves and none worsens, **mixed** if some worsen, and **advisory** if it changes the design or business model and cannot be "
    "recalculated. Only beneficial proposals are pre-selected, and gains under five percent are flagged as within the uncertainty."
)
h2("5.3 Marketplace Interaction")
fig_seq = figure(FIG / "fig_sequence.png", 4.2, "Interaction between manufacturer, platform and supplier.")
para(
    f"In the marketplace (Figure {fig_seq}) a supplier publishes a listing; a manufacturer compares listings and sends a request, which the platform "
    "checks against the minimum order, available stock and any open request. The supplier accepts, quotes or declines; the manufacturer then orders, "
    "which reserves stock; the supplier confirms and dispatches; and delivery is recorded. Any past request or order can be repeated."
)
fig_uc = figure(FIG / "fig_usecase.png", 3.8, "Use case diagram.")
para(
    f"Figure {fig_uc} summarises each user's actions. Visitors can assess products and browse listings without an account."
)

# ------------------------------------------------------------------ 6. data collection
h1("6. Data Collection")
para(
    "Data was collected through experiments on the prototype. No survey or interview has been conducted yet, so the report makes no claims about user "
    "opinions. Four experiments were carried out:"
)
bullets(
    [
        "**Product assessments:** the engine was run on four demonstration products: a PET bottle, a cotton T-shirt, an aluminium laptop stand and a side table.",
        "**Material comparison:** one 500 ml bottle was assessed in five materials on grid and renewable electricity.",
        "**Automated testing:** 58 tests check the calculations against hand calculations, the rules, the database and the marketplace.",
        "**Marketplace workflow test:** the full manufacturer–supplier cycle was performed in the browser with demonstration accounts.",
    ]
)
para(
    "Demonstration products, suppliers and prices are fictional, and product results are model estimates. As the next step, a questionnaire and interviews "
    "with ten to fifteen manufacturers and recyclers in the Pune industrial area are proposed, to test usability and relevance."
)

# ------------------------------------------------------------------ 7. data analysis
h1("7. Data Analysis")
fig_st = figure(FIG / "chart_stage_shares.png", 4.5, "Share of the estimated carbon footprint by life-cycle stage (product assessments).")
para(
    f"The dominant stage differs by product (Figure {fig_st}). Raw materials give 72 percent of the bottle's footprint and 89 percent of the aluminium "
    "stand's; air freight gives 33 percent of the T-shirt's; and landfilled wood and cardboard give 28 percent of the side table's. A single generic rule "
    "would miss most of these hotspots, so each product needs its own analysis."
)
fig_opt = figure(FIG / "chart_optimised.png", 4.5, "Estimated batch footprint before and after the beneficial alternatives (product assessments).")
para(
    f"Applying the beneficial alternatives lowered the estimated footprint by 37 to 88 percent (Figure {fig_opt}); for the stand, recycled aluminium "
    "alone accounts for about 78 percent. These are modelled differences using the same illustrative factors, not verified reductions. Table 3 lists "
    "the bottle's recommendations."
)
table(
    ["Recommendation for the PET bottle", "Carbon change", "Classification"],
    [
        ["Replace virgin PET with recycled PET", "−43%", "Beneficial"],
        ["Source renewable electricity", "−14%", "Beneficial"],
        ["Improve energy efficiency; lightweight packaging by 20%", "−4.5%; −2.0%", "Beneficial, within uncertainty"],
        ["Switch plastic film to recycled cardboard", "+2.2% (material use +13%)", "Mixed, not pre-selected"],
        ["Reusable packaging or product; design for recycling", "Not calculated", "Advisory"],
    ],
    [3.2, 1.6, 1.6],
    "Recommendations for the demonstration bottle and their classification.",
)
para(
    "The cardboard result shows that “green” options are not assumed to be better: board needs about twice the mass of film, so it raises material "
    "use and is left out of the optimised design."
)
fig_lab = figure(FIG / "chart_material_lab.png", 4.5, "Estimated footprint of one 500 ml bottle in five materials (material comparison).")
para(
    f"In the material comparison (Figure {fig_lab}), recycled PET is lowest at about 56 g CO2e per bottle against 102 g for virgin PET. Glass has a "
    "lower factor per kilogram than PET but the highest result, about 677 g, because the bottle weighs eleven times more. Materials must be judged per "
    "product, not per kilogram."
)
table(
    ["Test", "Scope", "Result"],
    [
        ["Automated tests (58)", "Engine formulas, rules, comparison, reports, accounts, access control, listings, requests, orders, stock, repeats", "58 passed, 0 failed"],
        ["Browser: compare and request", "Compared three listings for 800 kg; sent a 600 kg request; duplicate request blocked", "As expected"],
        ["Browser: quote and order", "Supplier quoted ₹229/kg; order placed for ₹1,37,400; stock reserved", "As expected"],
        ["Browser: tracking and repeat", "Confirmed, dispatched and delivered with timeline notes; order repeated as a new request", "As expected"],
    ],
    [1.7, 3.6, 1.1],
    "Testing results (automated tests and marketplace workflow test).",
)

# ------------------------------------------------------------------ 8. analysis conclusion
h1("8. Analysis Conclusion")
para(
    "The prototype meets its five objectives at a functional level. It estimates impact before production, finds each product's own hotspot, and "
    "recalculates every alternative instead of assuming it helps; in the four cases the beneficial alternatives lowered the estimate by 37 to 88 percent "
    "and exposed counter-intuitive cases such as glass and cardboard. The marketplace then makes the recommended materials available to compare, request, "
    "order, track and reorder. Together the modules support SDG 12, SDG 9 and SDG 13. Because most factors are illustrative and no user study has been "
    "done, the results demonstrate the method and the software, not actual environmental savings."
)

# ------------------------------------------------------------------ 9. limitations
h1("9. Limitations")
bullets(
    [
        "Most factors are illustrative; only five electricity factors are published (IPCC). Results are estimates, not an ISO 14040/14044 LCA.",
        "Only manufacturing electricity is counted; process heat, the use phase and inbound transport are excluded, and swaps assume equal mass.",
        "No survey or interviews have been conducted, so usefulness to real users is untested.",
        "Marketplace data is fictional; there is no supplier verification, payment, invoicing or notifications.",
        "SQLite and a single server suit demonstration, not many simultaneous users.",
    ]
)

# ------------------------------------------------------------------ 10. future scope
h1("10. Future Scope")
bullets(
    [
        "Use published datasets such as the ICE database and UK conversion factors (Hammond and Jones 2008; DESNZ 2024), with country-specific electricity.",
        "Conduct the proposed survey and pilot the platform with local manufacturers and recyclers.",
        "Add supplier verification, ratings, notifications, invoices and payments.",
        "Automatically match industrial waste producers with manufacturers by material, location and quantity.",
        "Move to PostgreSQL and deploy the platform for multiple organisations.",
    ]
)

# ------------------------------------------------------------------ references
page_break()
h1("External References")
refs = [
    "Ceschin, Fabrizio, and İdil Gaziulusoy. 2016. “Evolution of Design for Sustainability: From Product Design to Design for System Innovations and Transitions.” *Design Studies* 47: 118–163. https://doi.org/10.1016/j.destud.2016.09.002.",
    "Chertow, Marian R. 2000. “Industrial Symbiosis: Literature and Taxonomy.” *Annual Review of Energy and the Environment* 25: 313–337. https://doi.org/10.1146/annurev.energy.25.1.313.",
    "DESNZ (Department for Energy Security and Net Zero). 2024. *Greenhouse Gas Reporting: Conversion Factors 2024*. London: UK Government. https://www.gov.uk/government/publications/greenhouse-gas-reporting-conversion-factors-2024.",
    "Ellen MacArthur Foundation. 2013. *Towards the Circular Economy*. Vol. 1, *Economic and Business Rationale for an Accelerated Transition*. Cowes, UK: Ellen MacArthur Foundation.",
    "European Parliament and Council of the European Union. 2008. “Directive 2008/98/EC of 19 November 2008 on Waste and Repealing Certain Directives.” *Official Journal of the European Union* L 312: 3–30.",
    "Hammond, Geoffrey P., and Craig I. Jones. 2008. “Embodied Energy and Carbon in Construction Materials.” *Proceedings of the Institution of Civil Engineers – Energy* 161 (2): 87–98. https://doi.org/10.1680/ener.2008.161.2.87.",
    "ISO (International Organization for Standardization). 2006a. *ISO 14040:2006 Environmental Management – Life Cycle Assessment – Principles and Framework*. Geneva: ISO.",
    "ISO (International Organization for Standardization). 2006b. *ISO 14044:2006 Environmental Management – Life Cycle Assessment – Requirements and Guidelines*. Geneva: ISO.",
    "Kaza, Silpa, Lisa C. Yao, Perinaz Bhada-Tata, and Frank Van Woerden. 2018. *What a Waste 2.0: A Global Snapshot of Solid Waste Management to 2050*. Washington, DC: World Bank. https://doi.org/10.1596/978-1-4648-1329-0.",
    "Schlömer, Steffen, Thomas Bruckner, Lew Fulton, Edgar Hertwich, Alan McKinnon, Daniel Perczyk, Joyashree Roy, et al. 2014. “Annex III: Technology-Specific Cost and Performance Parameters.” In *Climate Change 2014: Mitigation of Climate Change. Contribution of Working Group III to the Fifth Assessment Report of the Intergovernmental Panel on Climate Change*, edited by Ottmar Edenhofer et al., 1329–1356. Cambridge: Cambridge University Press.",
    "United Nations. 2015. *Transforming Our World: The 2030 Agenda for Sustainable Development*. A/RES/70/1. New York: United Nations General Assembly. https://sdgs.un.org/2030agenda.",
]
for ref in refs:
    p = doc.add_paragraph()
    p.paragraph_format.first_line_indent = Inches(-0.5)
    p.paragraph_format.left_indent = Inches(0.5)
    p.paragraph_format.line_spacing_rule = WD_LINE_SPACING.SINGLE
    p.paragraph_format.space_after = Pt(8)
    add_runs(p, ref)

doc.core_properties.title = "Waste Before Waste – Project Report"
doc.core_properties.subject = "Pre-manufacturing environmental impact assessment and sustainable material sourcing platform"
doc.save(OUT)
print("saved", OUT)

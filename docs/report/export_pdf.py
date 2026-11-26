"""Opens the report in Microsoft Word, updates the table of contents and page
fields, saves the DOCX and exports an identical PDF. Then reports page and
line counts so the faculty limits can be checked.

Run from the repository root:  python docs/report/export_pdf.py
"""
from pathlib import Path

import fitz  # PyMuPDF
import win32com.client

HERE = Path(__file__).resolve().parent
DOCX = HERE / "Waste_Before_Waste_Project_Report.docx"
PDF = HERE / "Waste_Before_Waste_Project_Report.pdf"

word = win32com.client.DispatchEx("Word.Application")
word.Visible = False
word.DisplayAlerts = 0
try:
    doc = word.Documents.Open(str(DOCX))
    # Word rebuilds the TOC with its built-in "TOC 1" / "TOC 2" styles: make them single-spaced.
    for level, style_id in ((1, -20), (2, -21)):  # wdStyleTOC1, wdStyleTOC2
        st = doc.Styles(style_id)
        st.Font.Name = "Times New Roman"
        st.Font.Size = 12
        st.ParagraphFormat.LineSpacingRule = 0  # wdLineSpaceSingle
        st.ParagraphFormat.SpaceBefore = 0
        st.ParagraphFormat.SpaceAfter = 4 if level == 1 else 2
        st.ParagraphFormat.FirstLineIndent = 0
        st.ParagraphFormat.LeftIndent = 0 if level == 1 else 18
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.Fields.Update()
    for toc in doc.TablesOfContents:
        toc.Update()
    doc.Save()
    doc.ExportAsFixedFormat(str(PDF), 17)  # wdExportFormatPDF
    doc.Close(False)
finally:
    word.Quit()

# ------------------------------------------------------------------ counts
pdf = fitz.open(PDF)
start = end = None
for i, page in enumerate(pdf):
    lines_ = [ln.strip() for ln in page.get_text().splitlines()]
    if "...." in page.get_text():
        continue  # table of contents
    if start is None and "1. Introduction" in lines_:
        start = i
    if "External References" in lines_:
        end = i
lines = 0
for i in range(start, end):
    for block in pdf[i].get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            spans = [s for s in line["spans"] if s["text"].strip()]
            if not spans:
                continue
            size = max(s["size"] for s in spans)
            font = spans[0]["font"]
            # body text and headings are 12-14 pt; captions, tables and page numbers are smaller
            if size >= 11.5 and line["bbox"][1] < pdf[i].rect.height - 60:
                lines += 1
print(f"total pages: {len(pdf)}")
print(f"main body pages (Introduction to before References): {end - start}  (pdf pages {start + 1}-{end})")
print(f"main text lines (12 pt body and headings, excluding figures, tables, captions): {lines}")

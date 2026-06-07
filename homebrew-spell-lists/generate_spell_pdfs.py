#!/usr/bin/env python3
"""Generate full-reference PDF spell lists from the Dark Sun homebrew JSON files."""
import json
import os
import html
import re

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, KeepTogether,
    PageBreak, Table, TableStyle, FrameBreak, NextPageTemplate,
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "pdf-spell-lists")
os.makedirs(OUTDIR, exist_ok=True)

# (json filename, output pdf name, display title)
JOBS = [
    ("arcane_spell_list_v2_balanced.json",    "Arcane_Spell_List.pdf",    "Dark Sun — Arcane Tradition"),
    ("divine_spell_list_v2_balanced.json",    "Divine_Spell_List.pdf",    "Dark Sun — Divine Tradition"),
    ("nature_spell_list_v2_balanced.json",    "Nature_Spell_List.pdf",    "Dark Sun — Nature Tradition"),
    ("elemental_spell_list_v2_balanced.json", "Elemental_Spell_List.pdf", "Dark Sun — Elemental Tradition"),
    ("psionics_spell_list_v2_balanced.json",  "Psionics_Spell_List.pdf",  "Dark Sun — Psionics Tradition"),
    ("dndbeyond_spells_with_sources_v23_final_balanced.json",
     "Master_Spell_Database.pdf", "Dark Sun — Master Spell Database"),
]

LEVEL_ORDER = ["Cantrip", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"]
LEVEL_TITLE = {
    "Cantrip": "Cantrips",
    "1st": "1st Level", "2nd": "2nd Level", "3rd": "3rd Level",
    "4th": "4th Level", "5th": "5th Level", "6th": "6th Level",
    "7th": "7th Level", "8th": "8th Level", "9th": "9th Level",
}

ACCENT = colors.HexColor("#7a3b12")   # burnt sienna - Athasian desert
ACCENT2 = colors.HexColor("#a86a2c")
RULE = colors.HexColor("#c9a36a")
GREY = colors.HexColor("#555555")

styles = getSampleStyleSheet()

title_style = ParagraphStyle("DSTitle", parent=styles["Title"], fontName="Helvetica-Bold",
                             fontSize=30, textColor=ACCENT, alignment=TA_CENTER, leading=34)
subtitle_style = ParagraphStyle("DSsub", parent=styles["Normal"], fontSize=13,
                                textColor=GREY, alignment=TA_CENTER, leading=18, spaceBefore=6)
level_head = ParagraphStyle("DSLevel", parent=styles["Heading1"], fontName="Helvetica-Bold",
                            fontSize=18, textColor=colors.white, alignment=TA_LEFT,
                            backColor=ACCENT, borderPadding=(5, 6, 5, 6),
                            spaceBefore=14, spaceAfter=8, leading=22)
spell_name = ParagraphStyle("DSName", parent=styles["Heading2"], fontName="Helvetica-Bold",
                            fontSize=13, textColor=ACCENT, spaceBefore=9, spaceAfter=1, leading=15)
meta_line = ParagraphStyle("DSMeta", parent=styles["Italic"], fontSize=8.5, textColor=GREY,
                           leading=11, spaceAfter=2)
stat_line = ParagraphStyle("DSStat", parent=styles["Normal"], fontSize=9, leading=12, spaceAfter=1)
body = ParagraphStyle("DSBody", parent=styles["Normal"], fontSize=9.5, leading=12.5, spaceAfter=3)
toc_style = ParagraphStyle("DSToc", parent=styles["Normal"], fontSize=10, leading=15)


def esc(s):
    return html.escape(str(s or "")).strip()


def desc_paragraphs(text):
    """Split a description into reportlab paragraphs, bolding 'Heading.' leads."""
    text = (text or "").replace("\r\n", "\n").strip()
    out = []
    for chunk in re.split(r"\n\s*\n", text):
        chunk = chunk.strip()
        if not chunk:
            continue
        chunk = esc(chunk).replace("\n", "<br/>")
        # bold an italic-style lead like "Using a Higher-Level Spell Slot."
        m = re.match(r"^([A-Z][^.<]{2,60}\.)(\s|<br/>)", chunk)
        if m:
            chunk = "<b><i>%s</i></b>%s%s" % (m.group(1), m.group(2), chunk[m.end():])
        out.append(Paragraph(chunk, body))
    if not out:
        out.append(Paragraph("<i>No description available.</i>", body))
    return out


def spell_flowables(r):
    flow = []
    name = esc(r.get("Name"))
    flow.append(Paragraph(name, spell_name))

    school = esc(r.get("School"))
    lvl = r.get("Level", "")
    if lvl == "Cantrip":
        line = "%s cantrip" % school
    else:
        line = "%s-level %s" % (lvl, school.lower())
    tags = []
    if str(r.get("Ritual", "")).strip():
        tags.append("ritual")
    if str(r.get("Concentration", "")).strip():
        tags.append("concentration")
    if tags:
        line += " (" + ", ".join(tags) + ")"
    flow.append(Paragraph(esc(line), meta_line))

    # components + materials
    comp = esc(r.get("Components"))
    mats = esc(r.get("Materials"))
    if mats:
        comp = (comp + " — " + mats) if comp else mats

    rows = []
    def add(label, val):
        val = esc(val)
        if val:
            rows.append("<b>%s:</b> %s" % (label, val))
    add("Casting Time", r.get("Casting Time"))
    add("Range", r.get("Range"))
    if esc(r.get("Area")):
        add("Area", r.get("Area"))
    add("Components", comp)
    add("Duration", r.get("Duration"))
    if esc(r.get("Attack/Save")):
        add("Attack/Save", r.get("Attack/Save"))
    if esc(r.get("Damage/Effect")):
        add("Damage/Effect", r.get("Damage/Effect"))
    for rline in rows:
        flow.append(Paragraph(rline, stat_line))

    flow.append(Spacer(1, 2))
    flow.extend(desc_paragraphs(r.get("Description")))
    flow.append(Spacer(1, 4))
    return flow


def build(jsonfile, pdfname, title):
    with open(os.path.join(HERE, jsonfile)) as f:
        data = json.load(f)
    rows = data.get("rows", [])
    nsl = data.get("nativeSpellList") or {}
    listname = nsl.get("name") or title

    # group by level
    by_level = {}
    for r in rows:
        by_level.setdefault(r.get("Level", "?"), []).append(r)
    for lv in by_level:
        by_level[lv].sort(key=lambda x: (x.get("Name") or "").lower())

    ordered_levels = [lv for lv in LEVEL_ORDER if lv in by_level]
    ordered_levels += [lv for lv in by_level if lv not in LEVEL_ORDER]

    outpath = os.path.join(OUTDIR, pdfname)

    doc = BaseDocTemplate(
        outpath, pagesize=letter,
        leftMargin=0.7 * inch, rightMargin=0.7 * inch,
        topMargin=0.7 * inch, bottomMargin=0.7 * inch,
        title=title, author="Dark Sun Character Builder",
    )

    cover_frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="cover")
    # two-column body frames
    gap = 0.3 * inch
    colw = (doc.width - gap) / 2.0
    left = Frame(doc.leftMargin, doc.bottomMargin, colw, doc.height, id="left")
    right = Frame(doc.leftMargin + colw + gap, doc.bottomMargin, colw, doc.height, id="right")

    def footer(canvas, d):
        canvas.saveState()
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(GREY)
        canvas.drawString(d.leftMargin, 0.42 * inch, title)
        canvas.drawRightString(d.leftMargin + d.width, 0.42 * inch, "Page %d" % canvas.getPageNumber())
        canvas.setStrokeColor(RULE)
        canvas.setLineWidth(0.5)
        canvas.line(d.leftMargin, 0.58 * inch, d.leftMargin + d.width, 0.58 * inch)
        canvas.restoreState()

    doc.addPageTemplates([
        PageTemplate(id="Cover", frames=[cover_frame], onPage=footer),
        PageTemplate(id="Body", frames=[left, right], onPage=footer),
    ])

    story = []
    # ---- cover ----
    story.append(Spacer(1, 2.2 * inch))
    story.append(Paragraph(esc(title), title_style))
    story.append(Spacer(1, 0.15 * inch))
    story.append(Paragraph(esc(listname), subtitle_style))
    story.append(Spacer(1, 0.1 * inch))
    story.append(Paragraph("%d spells" % len(rows), subtitle_style))
    # spells-per-level summary
    summ = " &nbsp;•&nbsp; ".join(
        "%s: %d" % (LEVEL_TITLE.get(lv, lv), len(by_level[lv])) for lv in ordered_levels)
    story.append(Spacer(1, 0.25 * inch))
    story.append(Paragraph(summ, ParagraphStyle("sm", parent=subtitle_style, fontSize=10, textColor=ACCENT2)))

    story.append(NextPageTemplate("Body"))
    story.append(PageBreak())

    # ---- body ----
    for lv in ordered_levels:
        spells = by_level[lv]
        story.append(Paragraph("%s &nbsp;<font size=11>(%d)</font>" % (LEVEL_TITLE.get(lv, lv), len(spells)), level_head))
        for r in spells:
            story.append(KeepTogether(spell_flowables(r)))

    doc.build(story)
    return outpath, len(rows)


if __name__ == "__main__":
    results = []
    for jf, pn, tt in JOBS:
        if not os.path.exists(os.path.join(HERE, jf)):
            print("SKIP (missing):", jf)
            continue
        path, n = build(jf, pn, tt)
        size = os.path.getsize(path)
        print("OK  %-28s %4d spells  %7.1f KB" % (os.path.basename(path), n, size / 1024))
        results.append(path)
    print("\nWrote %d PDFs to %s" % (len(results), OUTDIR))

"""Builds the Prahari (ST-911) Sustain-a-thon deck on the official template. Every number below comes from
data-pipeline/ (inventory run 2026-09-26 23:16 UTC) or a cited public source."""
import json, sys
from pptx import Presentation
from pptx.util import Inches as I, Pt
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.chart.data import CategoryChartData
from pptx.enum.chart import XL_CHART_TYPE, XL_LABEL_POSITION, XL_LEGEND_POSITION

sys.path.insert(0, ".")
from notes import NOTES

TPL = "template.pptx"
IMG = "/tmp/claude-0/shots2/"
OUT = "Prahari_ST-911_Vayu_Lekha.pptx"

NAVY = "1B3A7A"; BLUE = "1E6FD9"; YEL = "F9CE26"; INK = "1F2937"; MUTED = "5B6B8C"
TINT = "EEF3FB"; LINE = "D5DEEE"; ORANGE = "E0662B"; GREEN = "1F9D63"; YTINT = "FFF7D6"; WHITE = "FFFFFF"
F = "Arial"


def rgb(h): return RGBColor.from_string(h)


def shape(sl, kind, x, y, w, h, fill=None, line=None, lw=1.0, rad=0.08):
    s = sl.shapes.add_shape(kind, I(x), I(y), I(w), I(h))
    if kind == MSO_SHAPE.ROUNDED_RECTANGLE:
        s.adjustments[0] = rad
    if fill:
        s.fill.solid(); s.fill.fore_color.rgb = rgb(fill)
    else:
        s.fill.background()
    if line:
        s.line.color.rgb = rgb(line); s.line.width = Pt(lw)
    else:
        s.line.fill.background()
    s.shadow.inherit = False
    st = s._element.find('{http://schemas.openxmlformats.org/presentationml/2006/main}style')
    if st is not None:
        s._element.remove(st)
    s.text_frame.text = ""
    return s


def box(sl, x, y, w, h, fill=None, line=None, rad=0.08, lw=1.0):
    return shape(sl, MSO_SHAPE.ROUNDED_RECTANGLE, x, y, w, h, fill, line, lw, rad)


def text(sl, x, y, w, h, paras, size=18, color=INK, bold=False, align="l", anchor="t", italic=False,
         spacing=None, margin=0.0, target=None):
    """paras: str | list of paragraphs; a paragraph is str or list of (text, dict) runs."""
    if target is None:
        tb = sl.shapes.add_textbox(I(x), I(y), I(w), I(h))
    else:
        tb = target
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = I(margin); tf.margin_top = tf.margin_bottom = I(0.02)
    tf.vertical_anchor = {"t": MSO_ANCHOR.TOP, "m": MSO_ANCHOR.MIDDLE, "b": MSO_ANCHOR.BOTTOM}[anchor]
    if isinstance(paras, str):
        paras = [paras]
    for i, p in enumerate(paras):
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        para.alignment = {"l": PP_ALIGN.LEFT, "c": PP_ALIGN.CENTER, "r": PP_ALIGN.RIGHT}[align]
        if spacing:
            para.space_after = Pt(spacing)
        runs = [(p, {})] if isinstance(p, str) else p
        for t, o in runs:
            r = para.add_run(); r.text = t
            fo = r.font; fo.name = o.get("font", F); fo.size = Pt(o.get("size", size))
            fo.bold = o.get("bold", bold); fo.italic = o.get("italic", italic)
            fo.color.rgb = rgb(o.get("color", color))
    return tb


def circle(sl, x, y, d, fill, label, size=18, color=NAVY):
    c = shape(sl, MSO_SHAPE.OVAL, x, y, d, d, fill)
    text(sl, 0, 0, 0, 0, [[(label, {"bold": True})]], size=size, color=color, align="c", anchor="m", target=c)
    return c


def arrow(sl, x, y, w, h, fill=YEL):
    return shape(sl, MSO_SHAPE.RIGHT_ARROW, x, y, w, h, fill)


def pic(sl, path, x, y, w=None, h=None, border=LINE):
    p = sl.shapes.add_picture(path, I(x), I(y), I(w) if w else None, I(h) if h else None)
    if border:
        p.line.color.rgb = rgb(border); p.line.width = Pt(1)
    return p


def style_chart(ch, title, size=15):
    ch.has_title = True
    ch.chart_title.text_frame.text = title
    for p in ch.chart_title.text_frame.paragraphs:
        for r in p.runs:
            r.font.size = Pt(size + 2); r.font.bold = True; r.font.color.rgb = rgb(NAVY); r.font.name = F
    ch.font.size = Pt(size); ch.font.name = F; ch.font.color.rgb = rgb(INK)
    ch.has_legend = False


def set_run_texts(sl, mapping):
    for sh in iter_shapes(sl.shapes):
        if sh.has_text_frame:
            for p in sh.text_frame.paragraphs:
                for r in p.runs:
                    if r.text in mapping:
                        r.text = mapping[r.text]


def iter_shapes(shs):
    for s in shs:
        yield s
        if s.shape_type == 6:
            yield from iter_shapes(s.shapes)


prs = Presentation(TPL)
S = prs.slides

# ---------- footers on every slide ----------
for i, sl in enumerate(S):
    set_run_texts(sl, {"ST1XX": "ST-911", "   |   Team Name": "   |   Team Prahari", "TEAM ID: ST1XX": "TEAM ID: ST-911"})
    if i == 1:  # slide 2 footer has no team-name run
        for sh in iter_shapes(sl.shapes):
            if sh.has_text_frame and sh.text_frame.text.startswith("TEAM ID"):
                p = sh.text_frame.paragraphs[0]
                runs = p.runs
                runs[-1].text = runs[-1].text.rstrip()
                r = p.add_run(); r.text = "   |   Team Prahari"
                r.font.size = runs[0].font.size; r.font.color.rgb = rgb(WHITE); r.font.name = F
    sl.notes_slide.notes_text_frame.text = NOTES[i]

# =====================================================================================
# 1. PROJECT INTRODUCTION
# =====================================================================================
s = S[0]
for sh in iter_shapes(s.shapes):
    if not sh.has_text_frame:
        continue
    t = sh.text_frame.text
    if t.startswith("Your Project Title"):
        r = sh.text_frame.paragraphs[0].runs
        r[0].text = "Vāyu Lekha"
        for x in r[1:]:
            x.text = ""
        for p in sh.text_frame.paragraphs[1:]:
            for x in p.runs:
                x.text = ""
    elif t.startswith("One line"):
        sh.text_frame.paragraphs[0].runs[0].text = ("The air ledger: finds India's biggest methane leaks from free satellite data, "
                                                    "proves each one statistically, and ranks them by warming avoided per rupee.")
        sh.text_frame.paragraphs[0].runs[0].font.size = Pt(17)
        sh.text_frame.word_wrap = True
        sh.top = I(5.55); sh.height = I(0.95)
    elif t.startswith("Problem Statement"):
        p0 = sh.text_frame.paragraphs[0]
        p0.runs[0].text = "Problem Statement: "
        r = p0.add_run(); r.text = "PS-13-S3 · Finding India's Methane Super-Emitters From Orbit"
        r.font.size = p0.runs[0].font.size; r.font.bold = False; r.font.color.rgb = rgb(INK); r.font.name = F
        sh.top = I(6.85)
# team row
box(s, 10.12, 7.78, 8.85, 0.8, TINT, None, 0.2)
text(s, 10.32, 7.78, 8.5, 0.8,
     [[("Team Prahari   ", {"bold": True, "color": NAVY}), ("L. Vishwa  ·  Vikranth Jayasarathy  ·  Yateesh", {"color": INK})]],
     size=19, anchor="m")

# =====================================================================================
# 2. PROBLEM STATEMENT
# =====================================================================================
s = S[1]
box(s, 0.75, 2.2, 9.9, 0.62, NAVY, None, 0.5)
text(s, 0.95, 2.2, 9.5, 0.62, [[("PS-13-S3  ·  ", {"bold": True, "color": YEL}),
                                 ("Finding India's Methane Super-Emitters From Orbit", {"color": WHITE})]], size=18, anchor="m")
text(s, 0.75, 3.0, 9.9, 1.35, "India is the world's second-largest methane emitter, yet no public map says which sites leak.",
     size=29, bold=True, color=NAVY)
stats = [("~80×", ORANGE, "the warming of CO₂ over 20 years, tonne for tonne (IPCC AR6)"),
         ("30 Mt", NAVY, "methane from India in 2023, second only to China (IEA)"),
         ("~30%", BLUE, "of global warming since the Industrial Revolution is methane (IEA)")]
for k, (big, col, lab) in enumerate(stats):
    x = 0.75 + k * 3.35
    box(s, x, 4.5, 3.15, 2.25, TINT, None, 0.08)
    text(s, x + 0.22, 4.6, 2.8, 1.0, big, size=50, bold=True, color=col)
    text(s, x + 0.22, 5.6, 2.8, 1.1, lab, size=15, color=INK)
pains = [("1", "No site-level inventory", "India reports national totals. Nobody publishes which landfill or coal field leaks how much."),
         ("2", "Raw satellite data is not an answer", "7 km pixels, bright-desert and haze bias, and a monsoon that hides most of India from June to September."),
         ("3", "A wrong accusation is costly", "Naming a site needs statistical proof, an independent check and a human sign-off, not a bright pixel.")]
for k, (n, h, d) in enumerate(pains):
    y = 7.05 + k * 1.12
    circle(s, 0.75, y + 0.08, 0.62, YEL, n, 20)
    text(s, 1.6, y, 9.1, 1.05, [[(h + "  ", {"bold": True, "color": NAVY, "size": 19})], [(d, {"size": 15})]], size=15)
# right: coverage chart
box(s, 11.1, 2.2, 8.15, 6.35, WHITE, LINE, 0.04)
cd = CategoryChartData()
cd.categories = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
vals = [24659, 26473, 20843, 14770, 8555, 3027, 600, 916, 3471, 14459, 26535, 26554]
cd.add_series("Clear pixels per day", vals)
gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, I(11.3), I(2.35), I(7.8), I(5.4), cd)
ch = gf.chart
style_chart(ch, "Clear methane pixels over India per day, by month", 14)
pl = ch.plots[0]; pl.gap_width = 45
ser = pl.series[0]
ser.format.fill.solid(); ser.format.fill.fore_color.rgb = rgb(BLUE)
for idx in (5, 6, 7, 8):
    pt = ser.points[idx]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(ORANGE)
pl.has_data_labels = True
dl = pl.data_labels; dl.number_format = '#,##0'; dl.number_format_is_linked = False
dl.position = XL_LABEL_POSITION.OUTSIDE_END; dl.font.size = Pt(11); dl.font.color.rgb = rgb(MUTED)
va = ch.value_axis; va.visible = False; va.has_major_gridlines = False
ch.category_axis.tick_labels.font.size = Pt(13); ch.category_axis.format.line.color.rgb = rgb(LINE)
text(s, 11.35, 7.72, 7.7, 0.8, [[("July sees ~44× fewer clear pixels than December. ", {"bold": True, "color": ORANGE}),
                                  ("Our measurement: 2,597 Sentinel-5P files, Jan 2023 to Sep 2026.", {"color": MUTED})]], size=14)
box(s, 11.1, 8.75, 8.15, 1.65, YTINT, None, 0.08)
text(s, 11.35, 8.8, 7.7, 1.55,
     [[("Landfills are the fastest methane to fix. ", {"bold": True, "color": NAVY}),
       ("India has 2,438 legacy dumpsites under Swachh Bharat, and waste-sector emissions are projected to "
        "rise from 20 to 76 Mt CO₂e by 2030 (Harvard Salata Institute, 2024).", {})]], size=15, anchor="m")

# =====================================================================================
# 3. PROPOSED SOLUTION
# =====================================================================================
s = S[2]
box(s, 0.75, 2.2, 18.5, 0.95, NAVY, None, 0.3)
text(s, 1.05, 2.2, 18.0, 0.95, [[("In one line: ", {"bold": True, "color": YEL}),
                                 ("Vāyu Lekha turns every clear Sentinel-5P pass over India into a statistically checked, ranked ledger of "
                                  "the methane sources worth fixing first, refreshed every 3 hours and free to read.", {"color": WHITE})]],
     size=18, anchor="m")
stages = [("ingest", "1 · INGEST", "Samrat Yantra", "Newest pass every 3 h; each file checksum-matched to Copernicus", "Checksum · qa ≥ 0.5"),
          ("observe", "2 · CLEAN", "TROPOMI floor map", "Remove surface-brightness and haze bias; weight each pass by its noise", "ABD · SRECE"),
          ("seasons", "3 · SEASONS", "Rashivalaya Yantra", "Drop monsoon months; subtract paddy and regional background per site", "Monsoon exclusion · Plane bg"),
          ("anomalies", "4 · FIND", "Jai Prakash Yantra", "Continuity equation: where more methane leaves than arrives", "Flux divergence · Blind screen"),
          ("attribution", "5 · MEASURE", "Digamsha & Rama Yantra", "Turn each pass to its wind, stack, calibrate the rate, read CO", "Wind · DiverSR · KPW · OBC · EIV"),
          ("ledger", "6 · DECIDE", "The ledger", "5% false-discovery gate + independent check; rank by warming per ₹", "BY-FDR · WRPI · VOIT")]
cw, gap = 2.83, 0.304
for k, (img, step, inst, line, algs) in enumerate(stages):
    x = 0.75 + k * (cw + gap)
    box(s, x, 3.35, cw, 3.65, TINT, None, 0.05)
    pic(s, IMG + f"st_{img}.jpg", x, 3.35, w=cw, h=cw * 9 / 16, border=None)
    text(s, x + 0.14, 5.0, cw - 0.25, 0.4, [[(step, {"bold": True, "color": BLUE})]], size=15)
    text(s, x + 0.14, 5.33, cw - 0.25, 0.35, inst, size=12, italic=True, color=MUTED)
    text(s, x + 0.14, 5.65, cw - 0.25, 0.95, line, size=13, color=INK)
    text(s, x + 0.14, 6.58, cw - 0.25, 0.4, [[(algs, {"bold": True, "color": NAVY})]], size=11)
    if k < 5:
        arrow(s, x + cw + 0.02, 3.35 + cw * 9 / 32 - 0.16, 0.27, 0.32)
feats = [("Solves problem 1", "A site-level ledger, not a national total",
          "Every site gets a rate in t CH₄/h with its uncertainty, a CO fingerprint (burning or decay), and a rank by warming avoided per rupee."),
         ("Solves problem 2", "Reads through cloud, bias and noise",
          "Wind-rotated, footprint-drizzled stacking over 3.4 years; albedo and aerosol bias removed; monsoon reported as unseen, never guessed."),
         ("Solves problem 3", "Proof before blame",
          "Each site is tested against 24 pseudo-sites, a 5% false-discovery gate across all sites, an independent check and a human sign-off.")]
for k, (tag, h, d) in enumerate(feats):
    x = 0.75 + k * 6.25
    box(s, x, 7.2, 6.0, 2.0, WHITE, LINE, 0.06)
    box(s, x + 0.2, 7.32, 2.1, 0.4, YEL, None, 0.5)
    text(s, x + 0.2, 7.32, 2.1, 0.4, [[(tag, {"bold": True})]], size=12, color=NAVY, align="c", anchor="m")
    text(s, x + 0.2, 7.78, 5.6, 0.45, [[(h, {"bold": True})]], size=18, color=NAVY)
    text(s, x + 0.2, 8.22, 5.6, 0.95, d, size=13.5, color=INK)
mag = [("2,597", "files verified"), ("17.3 M", "clear pixels read"), ("3.4 yrs", "of record"),
       ("54", "places tested"), ("12", "confirmed · 7 in India"), ("3 h", "live refresh")]
for k, (n, lab) in enumerate(mag):
    x = 0.75 + k * 3.1
    text(s, x, 9.35, 3.0, 0.62, [[(n, {"bold": True})]], size=30, color=NAVY if k != 4 else ORANGE)
    text(s, x, 9.95, 3.0, 0.4, lab, size=13, color=MUTED)

# =====================================================================================
# 4. TECHNICAL ARCHITECTURE
# =====================================================================================
s = S[3]
flow = [("INPUTS", "Sentinel-5P TROPOMI CH₄ + CO · ERA5 winds · OpenStreetMap · ECB FX"),
        ("INGEST", "GitHub Actions every 3 h + daily · MD5 vs Copernicus · qa ≥ 0.5"),
        ("SCIENCE", "Python · NumPy · SciPy: stack → divergence → null → gates → rates"),
        ("DATA CONTRACT", "Versioned JSON / Parquet · public and partner views"),
        ("API", "Next.js 16 on Vercel · rate limits · CSP · partner login · CSV"),
        ("EXPERIENCE", "React Three Fiber 3D story · live ledger · site dossiers")]
fw, fg = 2.75, 0.4
for k, (h, d) in enumerate(flow):
    x = 0.75 + k * (fw + fg)
    fill = NAVY if k in (0, 5) else TINT
    tc = WHITE if k in (0, 5) else INK
    box(s, x, 2.2, fw, 2.2, fill, None, 0.07)
    text(s, x + 0.17, 2.3, fw - 0.3, 0.45, [[(h, {"bold": True, "color": YEL if k in (0, 5) else BLUE})]], size=15)
    text(s, x + 0.17, 2.8, fw - 0.3, 1.55, d, size=15.5, color=tc)
    if k < 5:
        arrow(s, x + fw + 0.06, 3.14, 0.28, 0.34)
text(s, 0.75, 4.62, 12.2, 0.45, [[("10 algorithms passed a pre-set test and run on every refresh  ", {"bold": True, "color": NAVY}),
                                   ("19 designed · 5 failed, published · 4 not built", {"color": MUTED})]], size=15)
algs = [("A1", "SRECE", "Noise weighting", "each pass by its own noise"),
        ("A2", "ABD", "Albedo / aerosol debias", "mean z 3.74 → 4.06"),
        ("C1", "MSFD", "CO co-emission leg", "CO found at all 5 emitters"),
        ("C2", "KPW", "Kuṭṭaka phase weighting", "mean z 4.06 → 4.37"),
        ("D2", "DiverSR", "Footprint drizzle", "every emitter above 3σ"),
        ("F1", "EIV-CRF", "CO/CH₄ fingerprint", "burning vs decay"),
        ("G1", "OBC", "Injection-recovery", "slope 0.992 · R² 0.9999"),
        ("G2", "BY-FDR gate", "5% FDR + independent check", "1 of 36 fakes gets through"),
        ("G3", "WRPI", "Warming per rupee", "cited costs · Monte Carlo"),
        ("H1", "VOIT", "Value-of-info tasking", "54% vs 18% re-detected")]
aw, ah = 2.29, 1.55
for k, (code, name, what, res) in enumerate(algs):
    x = 0.75 + (k % 5) * (aw + 0.19); y = 5.15 + (k // 5) * (ah + 0.17)
    kpw = name == "KPW"
    box(s, x, y, aw, ah, YEL if kpw else WHITE, None if kpw else LINE, 0.07)
    text(s, x + 0.14, y + 0.08, aw - 0.25, 0.4, [[(code + "  ", {"color": NAVY if kpw else BLUE, "bold": True}),
                                                 (name, {"bold": True, "color": NAVY})]], size=16)
    text(s, x + 0.14, y + 0.5, aw - 0.25, 0.45, what, size=12.5, color=INK)
    text(s, x + 0.14, y + 1.0, aw - 0.25, 0.45, [[(res, {"bold": True, "color": NAVY if kpw else GREEN})]], size=12.5)
# KPW spotlight
box(s, 0.75, 8.62, 12.15, 1.78, YTINT, None, 0.06)
cell = 0.44
import random
counts = [[9, 3, 6], [2, 12, 4], [7, 5, 3]]
mean_c = sum(map(sum, counts)) / 9
for r in range(3):
    for c in range(3):
        n = counts[r][c]
        shade = ["FDE68A", "F9CE26", "E0A800"][0 if n < 4 else (1 if n < 8 else 2)]
        sq = shape(s, MSO_SHAPE.RECTANGLE, 0.95 + c * cell, 8.8 + r * cell, cell - 0.03, cell - 0.03, shade)
        text(s, 0, 0, 0, 0, [[(str(n), {"bold": True})]], size=12, color=NAVY, align="c", anchor="m", target=sq)
text(s, 2.4, 8.7, 10.3, 0.45, [[("KPW · Āryabhaṭa's Kuṭṭaka (499 CE) meets Sentinel-5P", {"bold": True})]], size=17, color=NAVY)
text(s, 2.4, 9.15, 10.3, 1.2,
     "The orbit repeats every 16 days (227 orbits), so the site falls at a different spot inside its 5.5 × 7 km pixel on each pass "
     "(grid: passes per spot, illustrative). Kuṭṭaka solves the whole-number congruence that says which orbits land where; "
     "KPW weights each pass by mean count ÷ its bin's count, so every spot counts equally.", size=13, color=INK)
# ablation ladder
cd = CategoryChartData()
steps = ["Raw", "+ Plane background", "+ Monsoon & noise", "+ Wind rotation", "+ Footprint drizzle", "+ ABD", "+ KPW"]
fl = [7.3, 7.1, 6.9, 5.9, 5.4, 5.0, 4.8]
cd.categories = list(reversed(steps)); cd.add_series("Floor", list(reversed(fl)))
gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, I(13.3), I(4.62), I(5.95), I(5.1), cd)
ch = gf.chart; style_chart(ch, "Detection floor, t CH₄/h (1σ), step by step", 13)
pl = ch.plots[0]; pl.gap_width = 40; ser = pl.series[0]
ser.format.fill.solid(); ser.format.fill.fore_color.rgb = rgb(LINE)
for idx in (0, 1):
    pt = ser.points[idx]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(YEL if idx == 0 else BLUE)
for idx in (2, 3, 4):
    pt = ser.points[idx]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(BLUE)
pl.has_data_labels = True; dl = pl.data_labels; dl.number_format = '0.0'; dl.number_format_is_linked = False
dl.position = XL_LABEL_POSITION.OUTSIDE_END; dl.font.size = Pt(13); dl.font.bold = True; dl.font.color.rgb = rgb(NAVY)
ch.value_axis.visible = False; ch.value_axis.has_major_gridlines = False; ch.value_axis.minimum_scale = 0; ch.value_axis.maximum_scale = 8.6
ch.category_axis.tick_labels.font.size = Pt(12); ch.category_axis.format.line.color.rgb = rgb(LINE)
text(s, 13.4, 9.75, 5.8, 0.65, "Controlled ablation: 6 reference sites, same 24-pseudo-site null, one component added per row (r4_ablation.py).",
     size=11.5, color=MUTED)

# =====================================================================================
# 5. PROTOTYPE & DEMO
# =====================================================================================
s = S[4]
pic(s, IMG + "p_hero.jpg", 0.75, 2.2, w=10.4, h=6.5)
box(s, 0.75, 8.9, 10.4, 1.5, NAVY, None, 0.08)
text(s, 1.0, 8.9, 10.0, 1.5, [[("Live now  ", {"bold": True, "color": YEL}),
                                ("sustain-a-thon-plum.vercel.app", {"bold": True, "color": WHITE})],
                               [("Real Sentinel-5P passes, processed every 3 hours by GitHub Actions. "
                                 "Nothing on the site is simulated.", {"color": "C9D6EE", "size": 14})]], size=19, anchor="m")
pic(s, IMG + "p_table.jpg", 11.5, 2.2, w=3.8, h=2.6)
pic(s, IMG + "p_dossier.jpg", 15.45, 2.2, w=3.8, h=2.6)
text(s, 11.5, 4.85, 3.8, 0.4, "/ledger: ranked inventory + 4 checks", size=12, color=MUTED)
text(s, 15.45, 4.85, 3.8, 0.4, "Site dossier: Ghazipur, Delhi", size=12, color=MUTED)
text(s, 11.5, 5.3, 7.75, 0.45, [[("The 3-minute demo path", {"bold": True})]], size=18, color=NAVY)
demo = [("Night-sky hero", "newest pass time; 7 of 35 Indian sites confirmed"),
        ("Six story stages", "each Jantar Mantar instrument = one pipeline step"),
        ("/ledger", "live pass map, ranked inventory, per-site checks"),
        ("Ghazipur dossier", "30.1 t/h, z 8.9, CO/CH₄ 0.54 → decay, not fire"),
        ("/partner sign-in", "exact coordinates unlock; public stays at 25 km")]
for k, (h, d) in enumerate(demo):
    y = 5.82 + k * 0.52
    circle(s, 11.5, y + 0.04, 0.4, YEL, str(k + 1), 14)
    text(s, 12.05, y, 7.2, 0.5, [[(h + "  ", {"bold": True, "color": NAVY}), (d, {})]], size=14, anchor="m")
box(s, 11.5, 8.55, 7.75, 1.85, TINT, None, 0.08)
pic(s, IMG + "qr.png", 11.65, 8.68, w=1.6, h=1.6, border=None)
text(s, 13.45, 8.62, 5.7, 1.75, [[("Scan to open the live site", {"bold": True, "color": NAVY})],
                                  [("Backup: full screen recording of this path on the laptop and a USB drive. "
                                    "Code and every result file: github.com/neurosyncx7/sustain-a-thon", {"size": 13})]],
     size=16, anchor="m")

# =====================================================================================
# 6. IMPACT & SUSTAINABILITY
# =====================================================================================
s = S[5]
inv = json.load(open("/home/claude/sustain-a-thon/data-pipeline/inventory/inventory_public.json"))
india = [x for x in inv["sites"] if x["in_india"] and x["status"] == "confirmed"]
tot = sum(x["rate_t_h"]["p50"] for x in india)
avo = sum(x["priority"]["avoidable_tco2e20_per_yr"][1] for x in india) / 1e6
bigs = [(str(len(india)), "super-emitter clusters confirmed in India (5% false-discovery gate + an independent check)", ORANGE),
        (f"{tot:.0f} t/h", f"of methane from those {len(india)} places combined: about {tot*8760/1e6:.1f} Mt a year (20 km cluster totals)", NAVY),
        ("₹160", "per tonne CO₂e (20-yr) to abate at landfills: about 620 t avoided per ₹ lakh (EPA cost curve, IPCC AR6)", GREEN),
        (f"{avo:.0f} Mt", "CO₂e (20-yr) a year avoidable at these 7 if 50-85% of their methane is captured", BLUE)]
for k, (n, lab, col) in enumerate(bigs):
    y = 2.2 + k * 2.08
    text(s, 0.75, y, 5.9, 0.9, [[(n, {"bold": True})]], size=44, color=col)
    text(s, 0.75, y + 0.9, 5.9, 1.05, lab, size=13.5, color=INK)
names = {"deonar": "Deonar, Mumbai", "ghazipur": "Ghazipur, Delhi", "jharia": "Jharia coal field", "khajod": "Khajod, Surat",
         "jawaharnagar": "Jawaharnagar, Hyderabad", "pirana": "Pirana, Ahmedabad", "c30": "Lead near Rajkot*"}
india.sort(key=lambda x: x["rate_t_h"]["p50"])
cd = CategoryChartData(); cd.categories = [names.get(x["slug"], x["name"]) for x in india]
cd.add_series("t/h", [round(x["rate_t_h"]["p50"], 1) for x in india])
gf = s.shapes.add_chart(XL_CHART_TYPE.BAR_CLUSTERED, I(6.9), I(2.2), I(6.6), I(5.85), cd)
ch = gf.chart; style_chart(ch, "Confirmed in India: t CH₄/h (median)", 13)
pl = ch.plots[0]; pl.gap_width = 45; ser = pl.series[0]
ser.format.fill.solid(); ser.format.fill.fore_color.rgb = rgb(NAVY)
for i2, x in enumerate(india):
    if x["sector"] == "coal":
        pt = ser.points[i2]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb("5B6B8C")
    if x["slug"] == "c30":
        pt = ser.points[i2]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(BLUE)
pl.has_data_labels = True; dl = pl.data_labels; dl.number_format = '0.0'; dl.number_format_is_linked = False
dl.position = XL_LABEL_POSITION.OUTSIDE_END; dl.font.size = Pt(13); dl.font.bold = True; dl.font.color.rgb = rgb(NAVY)
ch.value_axis.visible = False; ch.value_axis.has_major_gridlines = False; ch.value_axis.maximum_scale = 80; ch.value_axis.minimum_scale = 0
ch.category_axis.tick_labels.font.size = Pt(13); ch.category_axis.format.line.color.rgb = rgb(LINE)
text(s, 7.0, 7.95, 6.4, 0.35, "Navy: landfill · grey: coal · blue: *found by the blind screen, sector unknown", size=11, color=MUTED)
box(s, 6.9, 8.4, 6.6, 2.0, YTINT, None, 0.07)
text(s, 7.1, 8.45, 6.25, 1.9,
     [[("Independent check. ", {"bold": True, "color": NAVY}),
       ("Carbon Mapper's 2025 survey named landfills in Hyderabad (Secunderabad) and Mumbai among the world's 25 "
        "largest methane emitters. We flag both from free public data alone.", {})]], size=14, anchor="m")
sdg = [("13", "3F7E44", "Climate Action", "the fastest lever on near-term warming (13.2, 13.3)"),
       ("11", "FD9D24", "Sustainable Cities", "dumpsites of Delhi, Mumbai, Hyderabad, Ahmedabad, Surat (11.6)"),
       ("3", "4C9F38", "Good Health", "landfill fires and air pollution near homes (3.9)"),
       ("12", "BF8B2E", "Responsible Consumption", "waste diversion and gas capture where it pays most (12.5)")]
for k, (n, col, nm, d) in enumerate(sdg):
    y = 2.2 + k * 1.5
    b = box(s, 13.8, y, 1.3, 1.3, col, None, 0.1)
    text(s, 0, 0, 0, 0, [[("SDG", {"size": 12, "bold": True})], [(n, {"size": 30, "bold": True})]], color=WHITE, align="c", anchor="m", target=b)
    text(s, 15.3, y, 3.95, 1.3, [[(nm, {"bold": True, "color": NAVY, "size": 17})], [(d, {"size": 13})]], size=13, anchor="m")
box(s, 13.8, 8.4, 5.45, 2.0, NAVY, None, 0.07)
text(s, 14.05, 8.45, 5.0, 1.9, [[("Sustainable by design", {"bold": True, "color": YEL, "size": 17})],
                                 [("Free public data, free-tier compute, open code: running cost today is about ₹0 a month.",
                                   {"color": WHITE, "size": 14})]], anchor="m")

# =====================================================================================
# 7. BUSINESS APPROACH
# =====================================================================================
s = S[6]
text(s, 0.75, 2.15, 6.6, 0.45, [[("Who uses it", {"bold": True})]], size=19, color=NAVY)
users = [("REG", "Regulators", "CPCB, 28 SPCBs, MoEFCC: which sites to inspect first, with evidence"),
         ("CITY", "City corporations", "2,438 legacy dumpsites: is remediation actually cutting methane?"),
         ("PSU", "Coal and oil & gas", "field-wide leak triage before sending ground crews"),
         ("MRV", "Carbon market and finance", "CCTS project developers, verifiers, ESG lenders: independent evidence")]
for k, (ic, h, d) in enumerate(users):
    y = 2.7 + k * 1.93
    box(s, 0.75, y, 6.6, 1.75, TINT, None, 0.07)
    circle(s, 0.95, y + 0.4, 0.95, NAVY, ic, 13, WHITE)
    text(s, 2.1, y + 0.1, 5.1, 1.55, [[(h, {"bold": True, "color": NAVY, "size": 18})], [(d, {"size": 14})]], anchor="m")
box(s, 7.65, 2.2, 5.85, 2.1, NAVY, None, 0.07)
text(s, 7.9, 2.25, 5.4, 2.0, [[("Value proposition", {"bold": True, "color": YEL, "size": 16})],
                              [("The cheapest first look: a free satellite screen says where to send a costly aircraft, drone or high-res "
                                "satellite, and later proves the fix worked.", {"color": WHITE, "size": 15})]], anchor="m")
box(s, 7.65, 4.5, 5.85, 1.2, YTINT, None, 0.07)
text(s, 7.85, 4.5, 5.5, 1.2, [[("54% vs 18%  ", {"bold": True, "color": ORANGE, "size": 20}),
                               ("re-detection of the sites VOIT ranks top vs the rest (backtest, p = 0.025)", {"size": 13})]], anchor="m")
tiers = [("Public", "Free", "ranked ledger, rates, checks; locations rounded to 25 km"),
         ("Partner", "₹8 L / board / yr", "exact coordinates, plume stacks, orbit lists, alerts"),
         ("Verification", "₹2 L / site / yr", "before/after MRV report for a capture or remediation project"),
         ("Tasking", "brokered", "VOIT-ranked targets for commercial high-res satellites")]
for k, (h, price, d) in enumerate(tiers):
    y = 5.9 + k * 1.14
    ind = k * 0.3
    box(s, 7.65 + ind, y, 5.85 - ind, 1.0, WHITE, LINE, 0.1)
    text(s, 7.85 + ind, y, 5.5 - ind, 1.0, [[(h + "  ", {"bold": True, "color": NAVY}), (price, {"bold": True, "color": GREEN})],
                                            [(d, {"size": 12.5})]], size=16, anchor="m")
cd = CategoryChartData(); cd.categories = ["Y1 · ₹0.98 Cr", "Y2 · ₹3.4 Cr", "Y3 · ₹8.0 Cr"]
cd.add_series("Partner boards", (0.48, 1.2, 2.0)); cd.add_series("City dumpsites", (0.30, 1.2, 3.0)); cd.add_series("Verification", (0.20, 1.0, 3.0))
gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_STACKED, I(13.8), I(2.2), I(5.45), I(4.9), cd)
ch = gf.chart; style_chart(ch, "Revenue estimate, ₹ crore", 13)
ch.has_legend = True; ch.legend.position = XL_LEGEND_POSITION.BOTTOM; ch.legend.include_in_layout = False; ch.legend.font.size = Pt(11)
pl = ch.plots[0]; pl.gap_width = 55; pl.overlap = 100
for ser, col in zip(pl.series, (NAVY, BLUE, YEL)):
    ser.format.fill.solid(); ser.format.fill.fore_color.rgb = rgb(col)
ch.value_axis.visible = False; ch.value_axis.has_major_gridlines = False
ch.category_axis.tick_labels.font.size = Pt(13)
box(s, 13.8, 7.25, 5.45, 3.15, TINT, None, 0.06)
text(s, 14.0, 7.3, 5.1, 3.05,
     [[("How we got these (planning estimates)", {"bold": True, "color": NAVY, "size": 14})],
      [("Y1  ", {"bold": True}), ("6 boards × ₹8 L + 10 cities × ₹3 L + 10 site-yrs × ₹2 L = ₹0.98 Cr", {})],
      [("Y2  ", {"bold": True}), ("15 boards, 40 cities, 50 site-yrs = ₹3.4 Cr", {})],
      [("Y3  ", {"bold": True}), ("25 boards, 100 cities, 150 site-yrs = ₹8.0 Cr", {})],
      [("Year 3 still reaches under 5% of India's legacy dumpsites. Infra cost stays near zero: public data, serverless hosting.",
        {"color": MUTED, "size": 12})]], size=12.5, spacing=5)

# =====================================================================================
# 8. FEASIBILITY & ROADMAP
# =====================================================================================
s = S[7]
text(s, 0.75, 2.15, 9.0, 0.45, [[("Feasible because it already runs", {"bold": True})]], size=19, color=NAVY)
proof = ["Live on Vercel; the pipeline runs every 3 hours on GitHub Actions",
         "₹0 data cost: Copernicus, ERA5 and OpenStreetMap are free and open",
         "3.4 years, 2,597 files, 17.3 M clear pixels already processed",
         "10 of 19 algorithm designs passed pre-set tests; 5 failures published",
         "Tiered access and human review built in, not bolted on"]
for k, p in enumerate(proof):
    y = 2.7 + k * 0.5
    circle(s, 0.75, y + 0.06, 0.36, GREEN, "✓", 12, WHITE)
    text(s, 1.25, y, 8.4, 0.48, p, size=14.5, anchor="m")
text(s, 0.75, 5.35, 9.0, 0.45, [[("Risks, and what we do about them", {"bold": True})]], size=19, color=NAVY)
risks = [("7 km pixels see clusters, not single facilities", "VOIT sends the top 5 to Carbon Mapper, EMIT or GHGSat"),
         ("Monsoon hides India June to September", "reported as unobserved, never guessed; more passes each year"),
         ("A wrong accusation", "5% FDR + independent check + human sign-off; public coordinates rounded"),
         ("OpenStreetMap too thin to name the sector", "EFA failed its test (5 of 7), so it stays off; next: SPCB facility lists"),
         ("A data source goes down", "checksum-verified mirror, daily backfill; the last good output stays live")]
for k, (r, m) in enumerate(risks):
    y = 5.88 + k * 0.91
    box(s, 0.75, y, 4.25, 0.8, "FDECEA", None, 0.1)
    text(s, 0.9, y, 4.0, 0.8, r, size=13, color="8A2D12", anchor="m", bold=True)
    arrow(s, 5.08, y + 0.26, 0.3, 0.28, GREEN)
    box(s, 5.45, y, 4.25, 0.8, "E6F5EE", None, 0.1)
    text(s, 5.6, y, 4.0, 0.8, m, size=13, color="12603C", anchor="m")
cd = CategoryChartData(); cd.categories = ["5 t/h", "10 t/h", "20 t/h", "40 t/h"]
cd.add_series("P(detect)", (0.08, 0.46, 1.0, 1.0))
gf = s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, I(10.2), I(2.2), I(9.05), I(3.85), cd)
ch = gf.chart; style_chart(ch, "How small a leak we catch (plumes injected into real data, OBC)", 13)
pl = ch.plots[0]; pl.gap_width = 60; ser = pl.series[0]
ser.format.fill.solid(); ser.format.fill.fore_color.rgb = rgb(BLUE)
for idx in (0, 1):
    pt = ser.points[idx]; pt.format.fill.solid(); pt.format.fill.fore_color.rgb = rgb(ORANGE if idx == 0 else YEL)
pl.has_data_labels = True; dl = pl.data_labels; dl.number_format = '0%'; dl.number_format_is_linked = False
dl.position = XL_LABEL_POSITION.OUTSIDE_END; dl.font.size = Pt(13); dl.font.bold = True; dl.font.color.rgb = rgb(NAVY)
ch.value_axis.visible = False; ch.value_axis.has_major_gridlines = False; ch.value_axis.maximum_scale = 1.2; ch.value_axis.minimum_scale = 0
ch.category_axis.tick_labels.font.size = Pt(13)
text(s, 10.2, 6.25, 9.05, 0.45, [[("Roadmap", {"bold": True})]], size=19, color=NAVY)
road = [("Now · Sep 2026", "10 algorithms live · 54 sites · public ledger and partner view", ORANGE),
        ("Q1 2027", "Pilot with one State PCB; first human-reviewed entries", NAVY),
        ("Q2-Q3 2027", "Facility registry → EFA re-test; NO₂ leg; high-res tasking", NAVY),
        ("2028", "MRV layer for India's carbon market (CCTS); Sentinel-5 data", NAVY)]
con = s.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, I(10.6), I(7.15), I(18.9), I(7.15))
con.line.color.rgb = rgb(LINE); con.line.width = Pt(3)
for k, (when, what, col) in enumerate(road):
    x = 10.2 + k * 2.3
    circle(s, x + 0.25, 6.95, 0.4, col, str(k + 1), 13, WHITE)
    text(s, x, 7.45, 2.2, 0.4, [[(when, {"bold": True})]], size=14, color=col)
    text(s, x, 7.85, 2.2, 1.6, what, size=14, color=INK)
box(s, 10.2, 9.35, 9.05, 1.05, YTINT, None, 0.2)
text(s, 10.4, 9.35, 8.7, 1.05, [[("Our ask: ", {"bold": True, "color": NAVY}),
                                 ("one pilot partner (a State PCB or city) to review our first entries with us.", {})]], size=15, anchor="m")

prs.save(OUT)
print("saved", OUT)

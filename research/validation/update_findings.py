"""Regenerates the R3/R4 sections of research/findings.md from the JSON outputs, so the prose
tables can never drift from the numbers the website serves. Run from the repo root."""
import json
from pathlib import Path

r = json.load(open("data-pipeline/r3/known_sites.json"))
a = json.load(open("data-pipeline/r3/ablation.json"))
rows = [
    f"| {v['name']} | {v['n_overpasses']} | "
    + " | ".join(f"{v['rate_kg_h'][m]/1000:.1f} [{v['ci68'][m][0]/1000:.1f}, {v['ci68'][m][1]/1000:.1f}] (z {v['z'][m]:.1f})" for m in ["IME", "CSF", "DIV"])
    + f" | {v['null_std']['DIV']/1000:.1f} |"
    for v in r.values()
]
abl = []
for name, sites in a.items():
    zs = [sites[s]["DIV"]["z"] for s in ("jawaharnagar", "deonar", "jharia", "pirana", "khajod")]
    fl = sum(sites[s]["DIV"]["null_sd"] for s in sites) / len(sites) / 1000
    abl.append(f"| {name.split('_', 1)[1]} | " + " | ".join(f"{z:.1f}" for z in zs) + f" | {fl:.1f} |")

tmpl = Path("research/validation/_r3r4_findings_template.md").read_text()
new = tmpl.replace("{ROWS}", "\n".join(rows)).replace("{ABL}", "\n".join(abl))
txt = Path("research/findings.md").read_text()
s, e = txt.index("## R3: quantifier comparison"), txt.index("## National blind screen")
txt = txt[:s] + new + txt[e:]
txt = txt.replace(
    "- `research/algorithms/quantifiers.py`: IME and cross-sectional mass-balance methods, real\n  code, not yet run against a known site to compare against the divergence method (R3 — next).\n",
    "- `research/algorithms/quantifiers.py`: superseded by `site_stack.py` (single-overpass versions kept\n  for reference; the mass-balance divisor bug found in review is not used anywhere).\n",
)
Path("research/findings.md").write_text(txt)
print("findings.md R3/R4 regenerated")

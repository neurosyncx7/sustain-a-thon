"""Writes the current inventory table into research/findings.md (between the R6 markers), so the
prose never drifts from data-pipeline/inventory/inventory.json. Run from the repo root."""
import json
from pathlib import Path

inv = json.loads(Path("data-pipeline/inventory/inventory.json").read_text())
rows = ["| # | Site | Tier | t CH4/h [68%] | z | q (BY) | Sector | t CO2e20 per INR lakh |", "|---|---|---|---|---|---|---|---|"]
for s in inv["sites"]:
    r = s["rate_t_h"]
    rate = f"< {r['p84']:.1f}" if s["status"] == "not detected" else f"{r['p50']:.1f} [{r['p16']:.1f}, {r['p84']:.1f}]"
    w = "-" if s["status"] == "not detected" else f"{s['priority']['wrpi_tco2e20_per_lakh_inr'][1]:.0f}"
    rows.append(f"| {s['priority_rank']} | {s['name']} | {s['status']} | {rate} | {s['z']:.1f} | {s['q']:.3f} | {s['sector']} | {w} |")
block = (f"<!-- R6-TABLE -->\nGenerated {inv['generated_utc'][:16]} UTC from TROPOMI {inv['data_span']['first']}..{inv['data_span']['last']}, "
         f"{inv['n_pixels']:,} pixels, {inv['n_tested']} sites tested: {inv['n_confirmed']} confirmed, {inv['n_detected']} at z >= 3.\n\n"
         + "\n".join(rows) + "\n<!-- /R6-TABLE -->")
p = Path("research/findings.md"); t = p.read_text()
if "<!-- R6-TABLE -->" in t:
    a, b = t.index("<!-- R6-TABLE -->"), t.index("<!-- /R6-TABLE -->") + len("<!-- /R6-TABLE -->")
    t = t[:a] + block + t[b:]
else:
    k = t.index("## Live operation")
    t = t[:k] + block + "\n\n" + t[k:]
p.write_text(t)
print("findings R6 table updated")

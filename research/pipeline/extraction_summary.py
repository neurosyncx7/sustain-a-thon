"""Summarise the whole archive's extraction logs (every granule ever read, deduplicated by key) into
data-pipeline/web/extraction.json, so the site's headline counts track the archive as it grows.
usage: python extraction_summary.py <data_dir>"""
import glob, json, sys
from collections import defaultdict
from pathlib import Path

data = sys.argv[1]
seen, failed = {}, set()
for f in sorted(glob.glob(f"{data}/tropomi/logs/*.json")):
    try:
        log = json.loads(Path(f).read_text())
    except Exception:
        continue
    for e in log:
        k = e.get("key")
        if not k:
            continue
        if "pixels" in e:
            seen[k] = max(seen.get(k, 0), int(e["pixels"]))
        elif "error" in e and k not in seen:
            failed.add(k)
failed -= set(seen)
months = defaultdict(lambda: dict(granules=0, pixels=0, failed=0))
for k, px in seen.items():
    m = k.split("/")[2] + "-" + k.split("/")[3]
    months[m]["granules"] += 1; months[m]["pixels"] += px
for k in failed:
    m = k.split("/")[2] + "-" + k.split("/")[3]
    months[m]["failed"] += 1
ms = sorted(months)
out = dict(product="Sentinel-5P TROPOMI OFFL L2 CH4 (methane_mixing_ratio_bias_corrected), qa_value>=0.5",
           source="s3://meeo-s5p (public mirror of Copernicus Sentinel-5P data)",
           region="India bbox 68-97.5E, 6.5-37.5N", period=f"{ms[0]}..{ms[-1]}",
           granules=len(seen), pixels=sum(seen.values()), failed_granules=len(failed),
           pipeline=".github/workflows/extract-tropomi.yml + live.yml -> research/ingestion/extract_month.py",
           months=[dict(month=m, **months[m]) for m in ms])
p = Path(__file__).resolve().parents[2] / "data-pipeline/web/extraction.json"
p.write_text(json.dumps(out, indent=1))
print(out["period"], out["granules"], out["pixels"], out["failed_granules"])

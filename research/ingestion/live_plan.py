"""Which days does the daily live ingest still need? Reads the archive already on the data branch
(grids/*.npz 'days' arrays) and returns the missing days from the last archived day up to yesterday
(UTC), at most 21 days back, grouped by month: [{"month": "YYYY-MM", "days": "d1,d2", "name": "..."}].
Days whose OFFL product is not yet on the mirror simply stay missing and are retried tomorrow."""
import glob, json, sys
from datetime import date, timedelta
import numpy as np

grid_dir = sys.argv[1]
have = set()
for f in glob.glob(f"{grid_dir}/*.npz"):
    try:
        have |= {str(d) for d in np.load(f)["days"]}
    except Exception:
        pass
today = date.today()
start = max(date.fromisoformat(max(have)) + timedelta(days=1) if have else today - timedelta(days=21),
            today - timedelta(days=21))
todo = [start + timedelta(days=i) for i in range((today - start).days) if str(start + timedelta(days=i)) not in have]
groups = {}
for d in todo:
    groups.setdefault(f"{d:%Y-%m}", []).append(str(d))
print(json.dumps([dict(month=m, days=",".join(v), name=f"{v[0]}_{v[-1]}") for m, v in groups.items()]))

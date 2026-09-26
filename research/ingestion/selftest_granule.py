"""Smoke test for extract_month.read_granule/grid_day against one real local granule."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
import extract_month as e  # noqa: E402

df = e.read_granule(Path(sys.argv[1]))
print("rows", None if df is None else df.shape)
print(df.iloc[0].to_dict())
g = e.grid_day(df)
print("cells observed:", int((g["count"] > 0).sum()), "of", g["count"].size)
for k in e.GRID_VARS:
    print(k, float(np.nanmean(g[k])))

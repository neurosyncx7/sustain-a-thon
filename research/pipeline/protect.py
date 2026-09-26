"""Tiered disclosure of the inventory (the dual-use gate) and human-review records.

The inventory is dual-use: exact coordinates and plume evidence help a regulator act, and could also
help someone misuse them. So the pipeline writes two products:

  inventory_public.json   everything needed to see the scale of the problem and the ranking: rates,
                          uncertainty, tiers, q-values, corroboration, priority, review state; locations
                          rounded to 0.25 deg (~25 km), no plume images, no orbit lists.
  inventory_full.json     the full evidence package (exact coordinates, plume stacks as PNG, orbits,
                          per-month coverage). The web server releases it only to signed-in partners
                          (web/src/lib/access.ts). Hardened option: with INVENTORY_KEY set it is written
                          instead as inventory.enc.json (AES-256-GCM), so it is not readable in the repo.

The satellite data and the code are public, so a determined actor could rebuild the screen; the gate
controls our curated, ranked, evidence-packaged product, the same way coordinated vulnerability
disclosure controls a write-up rather than the underlying software.

Human review: data-pipeline/review/decisions.json is an append-only list of analyst/partner decisions
({slug, decision, reviewer, organisation, date, note}), added by pull request so every decision has an
author, a timestamp and a review trail in git. The latest decision per site is attached to the entry;
without one, an entry is a machine candidate awaiting review, never an accusation.
"""
from __future__ import annotations

import base64, copy, hashlib, json, os
from pathlib import Path

PUBLIC_PRECISION_DEG = 0.25
DECISIONS = {"analyst_reviewed", "partner_verified", "rejected", "needs_field_check"}


def load_reviews(path: Path) -> dict:
    if not path.exists():
        return {}
    hist: dict = {}
    for d in json.loads(path.read_text()):
        if d.get("decision") not in DECISIONS:
            raise ValueError(f"unknown review decision {d.get('decision')!r} for {d.get('slug')}")
        hist.setdefault(d["slug"], []).append(d)
    for v in hist.values():
        v.sort(key=lambda d: d["date"])
    return hist


def review_state(slug: str, hist: dict) -> dict:
    h = hist.get(slug, [])
    if not h:
        return dict(state="machine_candidate", label="Machine candidate: awaiting analyst review", history=[])
    last = h[-1]
    label = {"analyst_reviewed": "Reviewed by an analyst", "partner_verified": "Verified by a regulatory partner",
             "rejected": "Rejected on review", "needs_field_check": "Analyst requests a field or high-resolution check"}[last["decision"]]
    return dict(state=last["decision"], label=label, last=last, history=h)


def _round(x: float) -> float:
    return round(round(x / PUBLIC_PRECISION_DEG) * PUBLIC_PRECISION_DEG, 2)


def redact(doc: dict) -> dict:
    pub = copy.deepcopy(doc)
    pub["access"] = dict(tier="public", location_precision_deg=PUBLIC_PRECISION_DEG,
                         withheld=["exact coordinates", "plume stack images", "orbit lists", "screen hit coordinates", "review notes"],
                         how_to_get_full=("Verified partners (pollution control boards, regulators, accredited researchers) "
                                          "receive the full evidence package after sign-in."))
    for s in pub["sites"]:
        s["lat"], s["lon"] = _round(s["lat"]), _round(s["lon"])
        ev = s["evidence"]
        ev.pop("orbits", None); ev.pop("stack", None)
        s["screen"]["hits"] = [dict(rank=h["rank"], z=h["z"]) for h in s["screen"].get("hits", [])]
        if s.get("attribution"):
            s["attribution"]["voters"] = [dict(sector=v["sector"], km=v["km"]) for v in s["attribution"]["voters"]]
        rv = s["review"]
        s["review"] = dict(state=rv["state"], label=rv["label"], date=(rv.get("last") or {}).get("date"),
                           organisation=(rv.get("last") or {}).get("organisation"))
    return pub


def encrypt(doc: dict, key_b64: str) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    key = base64.b64decode(key_b64)
    if len(key) != 32:
        raise ValueError("INVENTORY_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32)")
    iv = os.urandom(12)
    ct = AESGCM(key).encrypt(iv, json.dumps(doc, default=float).encode(), b"vayu-lekha/inventory/v1")
    return dict(alg="AES-256-GCM", aad="vayu-lekha/inventory/v1", key_id=hashlib.sha256(key).hexdigest()[:12],
                generated_utc=doc["generated_utc"], iv=base64.b64encode(iv).decode(), ct=base64.b64encode(ct).decode())


def decrypt(env: dict, key_b64: str) -> dict:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    pt = AESGCM(base64.b64decode(key_b64)).decrypt(base64.b64decode(env["iv"]), base64.b64decode(env["ct"]), env["aad"].encode())
    return json.loads(pt)

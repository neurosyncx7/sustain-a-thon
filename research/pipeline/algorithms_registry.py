"""The status of every algorithm designed for PS-13-S3, generated from the logged test results (never
typed by hand). Output: data-pipeline/inventory/algorithms.json, read by the web's evidence views.
status: validated = passed its pre-declared test and runs in the inventory;
        failed = implemented, tested on real data, did not pass (kept out of the inventory);
        partial = part implemented/tested, the rest needs data we do not have;
        not_implemented = designed only (reason given)."""
import json
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
R5 = REPO / "data-pipeline/r5"
R4 = json.loads((REPO / "data-pipeline/r3/ablation.json").read_text())


def r5(name):
    p = R5 / f"{name}.json"
    return json.loads(p.read_text()) if p.exists() else None


def z(variant, site):
    return round(R4[variant][site]["DIV"]["z"], 1)


def floor(variant):
    v = [R4[variant][s]["DIV"]["null_sd"] for s in R4[variant]]
    return round(sum(v) / len(v) / 1000, 1)


abd, obc, wit, eiv, byg, bys, dsr, hhp = (r5(n) for n in ("abd", "obc", "wit", "eiv", "byfdr", "byfdr_site", "diversr", "pwhhp"))

A = []
def add(code, name, stage, status, in_inventory, result, evidence, novelty):
    A.append(dict(code=code, name=name, stage=stage, status=status, in_inventory=in_inventory,
                  result=result, evidence=evidence, novelty=novelty))

add("A1", "SRECE (noise-covariance weighting)", "data quality", "validated", True,
    f"lite form (per-overpass background-annulus noise -> 1/sigma^2 weights, with monsoon exclusion): part of the "
    f"combined method that lifts every known emitter above 3 sigma (R4: +wind {floor('4_+wind')} -> combined {floor('5_combined')} t/h floor). "
    "Variogram/correlation-length form not built.", "data-pipeline/r3/ablation.json", "new (lite form)")
add("A2", "ABD (albedo/aerosol bias decorrelation)", "data quality", abd["status"], abd["status"] == "validated",
    f"mean z over 5 emitters {abd['mean_z']['final']:.2f} -> {abd['mean_z']['final+ABD']:.2f}; "
    f"floor {abd['mean_floor_kg_h']['final']/1e3:.1f} -> {abd['mean_floor_kg_h']['final+ABD']/1e3:.1f} t/h", "data-pipeline/r5/abd.json",
    "new for this use")
add("B1", "PW-HHP (Helmholtz projection of winds)", "transport", hhp["status"], False,
    f"national noise fell {100*(1-hhp['variants']['final+PW-HHP']['robust_sigma']/hhp['variants']['final']['robust_sigma']):.0f}% "
    f"but blind recovery fell {hhp['variants']['final']['n_recovered']} -> {hhp['variants']['final+PW-HHP']['n_recovered']} of 4 "
    "(Jawaharnagar lost). Unweighted variant: the gridded product has no column-mass per wind.", "data-pipeline/r5/pwhhp.json", "adapted")
add("B2", "NDC (null-divergence wind calibration)", "transport", "not_implemented", False,
    "replaced by per-site ERA5 100 m/10 m transport factor (gamma) + OBC slope, which are independently measurable",
    None, "new")
add("C1", "MSFD (multi-species flux divergence)", "flux", "partial", False,
    "CO leg built (same pixels, winds, operator; CO detected above its own null at all 5 emitters); NO2 not ingested",
    "data-pipeline/r5/eiv.json", "new combination")
add("C2", "KPW (Kuttaka phase-weighted stacking)", "flux", "not_implemented", False,
    "superseded: footprint drizzle samples every sub-pixel phase directly, so phase re-weighting has nothing left to fix",
    None, "new (Aryabhata's kuttaka)")
add("D1", "PSSI (sparse + smooth physics-prior inversion)", "separation", "not_implemented", False,
    "needs paddy (Sentinel-1 SAR/EVI) and livestock priors that are not ingested; the local plane background + "
    "monsoon exclusion does the separation in the current method", None, "new")
add("D2", "DiverSR (divergence super-resolution)", "separation", "partial", True,
    f"core (footprint-drizzled super-resolved stacking) validated in R4 (combined vs +wind); off-grid peak refinement FAILED: "
    f"mean blind distance {dsr['mean_km_before']:.1f} -> {dsr['mean_km_after']:.1f} km", "data-pipeline/r5/diversr.json", "adapted solver, new kernel")
add("D3", "WIT (wind-invariance test)", "separation", wit["status"], False,
    f"false-reject rate {wit['false_reject_rate']:.0%} on centred injections (needs <= 15%); power {wit['power']:.0%} against a "
    "neighbour at the disk edge (needs >= 50%). Divergence within a disk is already nearly wind-invariant.",
    "data-pipeline/r5/wit.json", "new")
add("D4", "MRI (monsoon residual imputation)", "separation", "not_implemented", False,
    "policy adopted without the imputation: monsoon months are reported as unobserved, never filled", None, "new")
add("E1", "MC-FOD (moisture-coupled landfill decay)", "time", "not_implemented", False,
    "needs soil-moisture and waste-input series per landfill", None, "new variant")
add("E2", "PKTD (process-kernel temporal decomposition)", "time", "not_implemented", False,
    "per-site monthly series are too sparse after monsoon exclusion (0-12 overpasses/month)", None, "new")
add("F1", "EIV-CRF (CO/CH4 ratio fingerprint)", "attribution", eiv["status"], False,
    f"ratio separated from the combustion boundary at {len(eiv['informative_sites'])} of 5 emitters "
    f"({', '.join(eiv['informative_sites'])}); gate needs 3", "data-pipeline/r5/eiv.json", "new")
add("F2", "EFA (evidence-fusion attribution)", "attribution", "not_implemented", False,
    "no facility registry ingested yet; sectors are given only for cited reference facilities", None, "new")
add("G1", "OBC (injection-recovery calibration)", "quantification", obc["status"], obc["status"] == "validated",
    f"recovery slope {obc['slope']:.3f} (R^2 {obc['r2']:.4f}, site CV {obc['site_cv']:.1%}); detection probability "
    + ", ".join(f"{int(k)//1000} t/h: {v:.0%}" for k, v in obc["p_detect_z3"].items()), "data-pipeline/r5/obc.json", "new")
add("G2", "BY-FDR inventory gate", "quantification", "validated" if bys["fake_discoveries"] <= 1 else "failed", True,
    f"site form: {bys['fake_discoveries']} of {bys['n_fake']} fake candidates admitted (size OK, p-values uniform KS p={bys['fake_p_ks_uniform']:.2f}); "
    f"conservative power: {len(bys['real_discoveries'])} of 5 emitters confirmed in a 42-site family. National-grid form: "
    f"{byg['n_discoveries']} discoveries (local minima are as deep as maxima, so the screen is a lead list, not an inventory).",
    "data-pipeline/r5/byfdr_site.json", "adapted")
add("G3", "WRPI (warming-per-rupee priority)", "priority", "validated", True,
    "transparent accounting over cited constants (AR6 GWP20, EPA landfill MAC, IEA fossil MAC) with Monte Carlo; x P(real)",
    "research/algorithms/wrpi.py", "new")
add("H1", "VOIT (value-of-information tasking)", "closing the loop", "not_implemented", False,
    "planned: rank tentative sites by how much a high-resolution overpass would change the priority order", None, "new")

out = REPO / "data-pipeline/inventory"; out.mkdir(parents=True, exist_ok=True)
(out / "algorithms.json").write_text(json.dumps(dict(
    generated_from=["data-pipeline/r3/ablation.json", "data-pipeline/r5/*.json"],
    counts={s: sum(a["status"] == s for a in A) for s in ("validated", "partial", "failed", "not_implemented")},
    algorithms=A), indent=1))
print({s: sum(a["status"] == s for a in A) for s in ("validated", "partial", "failed", "not_implemented")})

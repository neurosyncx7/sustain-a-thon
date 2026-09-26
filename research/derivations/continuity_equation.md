# The full column continuity equation, from first principles

This is the derivation the divergence method (Beirle et al. 2019; Liu et al. 2021) rests on,
worked from 3D mass conservation down to the operational column-flux-divergence formula,
including the two steps the literature review (see `research/prior-art.md`) flagged as missing
from the naive version, plus the averaging-kernel correction that the review didn't raise but
that matters once we're using the real TROPOMI L2 product's `column_averaging_kernel`.

## 1. 3D mass conservation

For methane number density $n(x,y,z,t)$ [mol/m³] with 3D wind $\mathbf{u} = (u,v,w)$ and a
volumetric source $q(x,y,z,t)$ [mol/(m³·s)]:

$$\frac{\partial n}{\partial t} + \nabla_3 \cdot (n\mathbf{u}) = q - kn$$

$k$ is the CH₄ loss rate from OH oxidation, lifetime $\tau = 1/k \approx 9$ years. Over the
hours-to-a-few-days transport timescale relevant to a single overpass or a multi-week stack,
$k\Delta t \sim 10^{-4}$–$10^{-3}$: **the sink term is negligible at these scales** and is
dropped from here on (kept explicit above so the omission is a stated approximation, not a
silent one).

## 2. Integrate over the column

Integrate vertically from the surface $z_s$ to the top of atmosphere, and split the wind into
its horizontal and vertical parts. Define the column number density $N(x,y,t) = \int n\,dz$
[mol/m²] and the column horizontal flux $\mathbf{F}(x,y,t) = \int n\mathbf{u}_h\,dz$
[mol/(m·s)]:

$$\frac{\partial N}{\partial t} + \nabla_h \cdot \mathbf{F} + \big[n w\big]_{z_s}^{\infty} = Q(x,y,t)$$

The vertical-flux boundary term vanishes at the top of atmosphere ($n\to 0$) and, over land
with no venting through the surface other than the source itself, is absorbed into $Q$ (the
column-integrated source rate, mol/(m²·s)) at the surface. For a steady-state or slowly-varying
column ($\partial N/\partial t \approx 0$ over the multi-week averaging window used here — this
is the standard divergence-method assumption, and its validity is exactly what the OSSE in
`research/validation/` tests):

$$\boxed{\nabla_h \cdot \mathbf{F}(x,y) \approx Q(x,y)}$$

**This is the key result: the horizontal divergence of the column flux equals the local
source strength.** No transport model of the diffuse background is needed — Section 5 of
`research/prior-art.md`'s critique of the original $\Omega_{bg}$ formulation follows directly
from this: $Q$ from a spatially smooth, non-divergent background field is small by
construction, so subtracting a *transported concentration* field was solving the wrong problem.

## 3. From number density to what TROPOMI actually reports

TROPOMI's L2 CH4 product does not report $N$ (mol/m²) directly. It reports
`methane_mixing_ratio_bias_corrected`, $X_{CH_4}$, a **dry-air column-averaged mixing ratio**
in ppb (units `1e-9`, confirmed against the real downloaded granule, 2026-09-26). The
conversion:

$$N(x,y,t) = X_{CH_4}(x,y,t) \times 10^{-9} \times N_{air}(x,y,t)$$

where $N_{air}$ is the **dry-air column** [mol/m²]. Two ways to get it, both present in the
real product and cross-checked against each other in `research/ingestion/fetch_tropomi.py`:

1. **From the product directly**: `dry_air_subcolumns` (INPUT_DATA group), summed over the
   `layer` dimension — this is exactly what the retrieval itself used, so it's the more
   internally consistent choice.
2. **From surface pressure** (the review's suggested formula, as a sanity check):
   $N_{air} = p_s / (g\,M_{air})$, giving $N_{air}\approx 3.5\times10^5$ mol/m² at $p_s=$
   1013 hPa. The two should agree to a few percent; a larger gap flags a retrieval or
   ingestion problem for that pixel.

## 4. The averaging kernel — why it matters for a divergence-based source estimate

TROPOMI's retrieval is not perfectly sensitive to every altitude equally; the
`column_averaging_kernel` $A(z)$ describes how much a true concentration change at level $z$
shows up in the retrieved column. Formally:

$$X_{CH_4}^{retrieved} = X_{CH_4}^{apriori} + \sum_z A(z)\,\big(x_{true}(z) - x_{apriori}(z)\big)$$

Near-surface point sources (landfills, coal vents) inject methane in the boundary layer. If
$A(z)$ is reduced near the surface for a given scene (common under high aerosol loading or low
surface albedo — see `research/derivations/albedo_bias.md`), a real point source is
**systematically under-reported**, independent of transport or background modeling. This is
why `research/ingestion/fetch_tropomi.py` keeps `ak_mean` and `dofs_ch4` per pixel: a low
degrees-of-freedom pixel over a candidate site is a flag that the divergence signal there may
be attenuated, not absent — this feeds directly into the uncertainty budget (R6), not just a
QA cutoff.

## 5. Non-divergent wind (Helmholtz decomposition)

The flux $\mathbf{F} = N\mathbf{v}$ uses ERA5 $\mathbf{v}$, which contains both a
non-divergent (rotational) and a divergent (compressible/terrain/synoptic) part:
$\mathbf{v} = \mathbf{v}_{nd} + \nabla\phi$. Only $\mathbf{v}_{nd}$ should be used — a
convergence zone from synoptic-scale dynamics or orography would otherwise register as a false
"source" under $\nabla\cdot(N\mathbf{v})$. Solve the Poisson equation

$$\nabla^2\phi = \nabla\cdot(p_s\mathbf{v})$$

over the analysis domain (pressure-weighted per Koene et al. 2024) and use
$\mathbf{v}_{nd} = \mathbf{v} - \nabla\phi/p_s$. Implemented in
`research/algorithms/pw_hhp.py` (status: candidate until the OSSE confirms it reduces
false-positive divergence over null pixels — see `research/algorithms/ndc.py`, the
null-divergence calibration that scores this directly).

## 6. The corrected, implementable formula

Putting it together, for a wind-rotated, multi-overpass-stacked scene:

$$E(x,y) = \nabla_h \cdot \Big[\big(X_{CH_4}(x,y) - X_{bg}(x,y)\big)\times 10^{-9}\times N_{air}(x,y) \times \mathbf{v}_{nd}(x,y)\Big]$$

with $X_{bg}$ now understood correctly (Section 2): it is not a transported concentration
field to subtract before differentiating — it is the **smooth part of the recovered $Q(x,y)$
field itself**, separated from the sparse point-source part by the joint inversion in
`research/algorithms/pssi.py` (PSSI), not subtracted upstream. Section 2's result is what
justifies doing the separation *after* taking the divergence, in flux space, rather than
*before*, in concentration space — this is the load-bearing correction to the original
proposal that PSSI operationalizes.

## What's derived vs. what's assumed
- **Derived here**: the divergence-equals-source result (Section 2), the ppb→mol/m² conversion
  (Section 3), the averaging-kernel attenuation mechanism (Section 4).
- **Assumed, stated explicitly, tested in R2/R3/OSSE**: negligible chemical sink (justified by
  lifetime vs. timescale, quantified above); quasi-steady column over the averaging window;
  Helmholtz decomposition adequately removes non-source divergence (tested via null-pixel
  divergence in NDC); finite-difference/pixel discretization of $\nabla_h\cdot$ underestimates
  a sub-pixel source (Koene et al. 2024) — corrected by the explicit PSF $K$ in PSSI, not
  assumed away.

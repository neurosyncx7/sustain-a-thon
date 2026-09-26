"""Shared constants for India-bounded ingestion. Real coordinates, no placeholders."""

# India mainland bounding box (WGS84), slightly padded to keep border facilities in-frame
# for divergence kernels that need neighborhood context.
INDIA_BBOX = dict(lon_min=68.0, lon_max=97.5, lat_min=6.5, lat_max=37.5)

# Known candidate super-emitter sites used throughout validation (R3, R5).
# Coordinates from the cited public sources in research/findings.md; each entry states
# its source so nothing here is asserted without provenance.
KNOWN_SITES = {
    "jawaharnagar": dict(lat=17.5375, lon=78.5972, name="Jawaharnagar landfill, Hyderabad",
                          source="UCLA STOP Methane / Carbon Mapper, 2026 (~5.9 t CH4/hr)"),
    "pirana": dict(lat=23.0432, lon=72.6602, name="Pirana landfill, Ahmedabad",
                    source="ISRO EMIT+TROPOMI urban hotspot study, Feb 2024"),
    "khajod": dict(lat=21.1230, lon=72.8811, name="Khajod landfill, Surat",
                    source="ISRO EMIT+TROPOMI urban hotspot study, Feb 2024"),
    "deonar": dict(lat=19.0503, lon=72.9110, name="Deonar/Mumbai landfill",
                    source="UCLA STOP Methane Project 2026 (~4.9 t CH4/hr)"),
    "jharia": dict(lat=23.7398, lon=86.4140, name="Jharia coal field, Jharkhand",
                    source="EGU 2025 Bayesian inversion coal clusters"),
    "korba": dict(lat=22.3595, lon=82.7501, name="Korba coalfield, Chhattisgarh",
                   source="EGU 2025 Bayesian inversion coal clusters"),
}

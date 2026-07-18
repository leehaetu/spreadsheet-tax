# Sales conversion — full live recapture after 1.33.0

**Date:** 2026-07-18  
**Live base:** https://spreadsheet-tax-production.up.railway.app  
**Capture version (live at audit):** 1.33.0  
**Method:** `scripts/audit-sales-live.mjs` + funnel click path  
**Artifacts:** `screenshots/` (~85–89 PNGs), `defects.json`, `AUDIT.md`

---

## Results

| Metric | Value |
|--------|------:|
| Routes × viewports | 17 × 2 = **34** page inspections |
| HTTP non-200 | **0** |
| P0 defects | **0** |
| P1 defects | **0** |
| Auto exit | **0** (pass) |

### Routes

`/`, `/self-employed`, `/landlords`, `/professionals`, `/firms`, `/how-it-works`, `/pricing`, `/templates`, `/security`, `/help`, `/license`, `/legal`, `/privacy`, `/terms`, `/signin`, `/register`, `/forgot-password`

### Funnel clicks

| Shot | Path |
|------|------|
| `funnel-01-home-to-self-employed.png` | Home → Self-employed |
| `funnel-02-self-employed-to-register.png` | Self-employed → Register |
| `funnel-03-pricing-to-register.png` | Pricing → Register |
| `funnel-04-template-download-nav.png` | Templates → template download |

---

## Scorecard vs pre-1.33.0 audit

| Lens | Pre (1.32.0) | After (1.33.0 live) |
|------|:------------:|:-------------------:|
| Readability desktop | 3.5 | **~4.8** (trust list white) |
| Visual polish | 3.5 | **~4.5** |
| Conversion readiness | 3.5 | **~4.3** |
| Automated P0 | 0* | **0** |

\*Prior human P0s (trust wash, ghost CTA, noisy product shot) are fixed; this automated pack finds **no P0/P1**.

---

## High-conversion definition (C1–C8)

| # | Status |
|---|--------|
| C1 P0 visual fails | **MET** (live pack 0 P0) |
| C2 Clean product image | **MET** |
| C3 Free dominates pricing | **MET** |
| C4 Mobile CTAs ≥ 44px | **MET** (earlier verify) |
| C5 Full recapture pack | **MET** (this folder) |
| C6 Live version | **MET** 1.33.0 at capture; ship 1.33.1 adds weekly readout |
| C7 Funnel works | **MET** |
| C8 No fake proof | **MET** |

**Not claimed:** measured very high conversion %, pilot-ready product, capacity MET.

---

## Related

- Prior audit: `docs/audits/2026-07-18-sales-conversion-review/`
- After partial: `docs/audits/2026-07-18-sales-conversion-after/`
- Weekly readout: `docs/SALES-WEEKLY-READOUT.md`

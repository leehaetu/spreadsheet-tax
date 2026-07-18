# All-screens UX audit — 2026-07-18

**Source:** Live app captures (Codex browser session) + illustrated PDF with per-screen improvements.  
**Purpose:** Single durable pack for every agent. Do not rely on `~/.codex/visualizations/…` alone.

## Contents

| Path | What |
|------|------|
| `spreadsheet-tax-all-screens-audit-2026-07-18.pdf` | **52-page** illustrated audit (screenshot + P0/P1 + 3 fixes per screen) |
| `screenshots/` | **51** full-page PNGs (signed-out + signed-in + populated review) |
| `screenshots/public-captures.json` | Signed-out capture metadata |
| `screenshots/auth-captures.json` | Signed-in capture metadata |
| `screenshots/contact-*.jpg` | Contact sheets of captures |
| `figma/figma-audit-flow.png` | Earlier Figma board — journey flow |
| `figma/figma-audit-blockers.png` | Earlier Figma board — launch blockers |
| `pdf-renders/page-*.jpg` | Rasterised PDF pages for quick preview |
| `test-results-visual/` | Older Playwright visual baselines (subset) |

## Rebuild PDF

```bash
python3 scripts/build-screen-audit-pdf.py
```

Script reads screenshots from this directory first, then falls back to the original Codex path.

## How to use (agents)

1. Open the PDF or the matching `screenshots/NN-*.png`.  
2. Treat comments as **P0 product/UX debt**, not optional polish.  
3. After UI changes, re-capture the same route/auth state and re-run the PDF builder.  
4. Do **not** claim visual QA complete without re-running captures.

## Systemic findings (summary)

- Two competing visual systems (light app vs dark sales).  
- Inconsistent navigation; demo/internal tools exposed as product.  
- Weak empty/error/signed-out states that look “live”.  
- Billing and admin surfaces overclaim.  
- Working quarterly review core buried under sprawl.

## Related

- `docs/PRODUCT-SURFACE-FREEZE.md`  
- `docs/STATUS.md`  
- Figma MCP audit board (Starter plan upload limit hit for full 51-image board)

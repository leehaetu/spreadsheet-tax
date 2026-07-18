# Design QA — complete taxpayer journey boards

## Comparison targets

- Source visual truth:
  - `/Users/leehine/Spreadsheet Tax/output/product-design/01-setup-and-income-sources.png`
  - `/Users/leehine/Spreadsheet Tax/output/product-design/02-quarterly-update-workflow.png`
  - `/Users/leehine/Spreadsheet Tax/output/product-design/03-year-end-history-and-errors.png`
- Browser-rendered implementation evidence:
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-1-signin-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-1-welcome-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-1-sources-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-1-source-detail-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-2-source-upload-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-2-mapping-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-2-figures-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-2-declaration-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-3-year-end-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-3-foreign-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-3-declaration-viewport.png`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-3-history-viewport.png`
- Same-input comparison evidence:
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-1-comparison.jpg`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-2-comparison.jpg`
  - `/Users/leehine/Spreadsheet Tax/test-results/design-qa/board-3-comparison.jpg`
- Viewport: 1280 × 720 desktop, device pixel ratio 2.
- State: signed-out sign-in plus authenticated demo taxpayer in preview mode; four fixture sources (self-employment, UK property, Spain property and France property).

## Findings

No actionable P0, P1 or P2 visual differences remain in the compared states.

- Fonts and typography: the implementation uses the existing system sans-serif stack with matching compact weights, hierarchy and line lengths. Headings, labels, supporting copy and table text retain the board hierarchy without clipping at the desktop viewport.
- Spacing and layout rhythm: fixed sidebar proportions, content canvas, cards, dividers, form grids, stage spacing and primary-action placement match the boards. The setup action bar remains fixed and does not obscure the active fields.
- Colours and visual tokens: white surfaces, pale-blue selection states, dark navy text, blue actions, green completion and amber/red recovery treatments map consistently to the boards.
- Image quality and assets: the boards contain product UI rather than photographic or illustrative assets. The supplied ST brand mark is used consistently. No missing raster asset or placeholder substitution was observed.
- Copy and content: labels are coherent and truthful in preview mode. Two source-board concepts were intentionally superseded by the user's compliance correction: businesses are retrieved from HMRC instead of created with local source buttons, and quarterly totals come through a digitally linked spreadsheet instead of manual total entry.
- Icons: the implementation favours the existing brand mark, status dots and clear text navigation. The board's small navigation icons are omitted rather than replaced with inconsistent handcrafted glyphs; this is acceptable P3 polish.
- Responsiveness and accessibility: desktop content remains within the viewport; controls retain visible labels and focusable native semantics. Sign-in, setup, tabs, filters, dialogs, checkboxes and primary actions are keyboard-addressable. Mobile quarterly coverage is exercised separately in the browser suite.

## Comparison history

1. Initial comparison found P1 workflow inaccuracies: local source creation, manual quarterly totals, and an account-manager choice unsupported by the intended individual journey. These were removed. HMRC business retrieval and digital-link spreadsheet copy replaced them.
2. Initial comparison found P1 structural drift: sign-in used marketing chrome, all business-detail forms appeared on one long setup screen, and year-end exposed identifiers and technical output before the checklist. Sign-in now uses the product shell, setup advances through one business per screen, and year-end opens on the checklist with connection details and technical responses collapsed.
3. Initial comparison found P2 year-end/history drift: foreign properties were not visually separated and recovery states were too implicit. Spain/France tabs, calculation/declaration states, a filtered evidence timeline, authority/upload/service/duplicate cards, unsaved-change handling and source-removal confirmation are now represented.
4. Post-fix comparison found a P2 empty ownership value for fixture sources without an explicit share. The setup model now applies the truthful 100% default only when no positive share exists. Post-fix browser evidence recorded `ownership: 100` in `board-1-source-detail-viewport.png`.
5. Final browser pass exercised the primary interactions and reported no console errors.

Focused regions were required because the full journey boards contain several small screens. Setup forms, quarterly mapping/figures/declaration, foreign-property tabs, final declaration, submission history and recovery cards were captured as separate matching viewport states and included in the comparison collages.

## Follow-up polish

- P3: introduce a single licensed icon family for sidebar/navigation icons if the product later adopts an icon package.
- P3: reduce the density of the advanced spreadsheet inspection table for smaller laptop heights without removing its audit evidence.

final result: passed

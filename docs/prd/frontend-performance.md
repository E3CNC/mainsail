# PRD: Frontend Performance (Lighthouse follow-up)

- **Status:** Proposed
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-08
- **Scope:** `public/fonts/`, `src/assets/styles/fonts.css`, `src/main.ts`, `src/components/charts/`, `src/plugins/router.ts` / `src/routes/`, `package.json`, icon-only controls (a11y)

## 1. Problem

A Lighthouse audit (desktop preset, 2026-10-08, production `dist/` served
same-origin by `node mock-moonraker.cjs`) shows the app ships far too much
up front:

| Category       | Score  |
| -------------- | ------ |
| Performance    | **36** |
| Accessibility  | 72     |
| Best practices | 100    |
| SEO            | 82     |

Key timings: FCP 4.9s · LCP 7.3s · TTI 7.3s · TBT 449ms · CLS 0. Total
transfer **7.9 MB**. The root causes are all in how we bundle static assets,
not in application logic:

1. **Fonts are 60% of the payload (4.7 MB of raw TTF).**
   `public/fonts/0xproto/` ships `0xProtoNerdFontMono` Regular + Bold
   (2.3 MB each) plus Italic as uncompressed `.ttf`, loaded via `@font-face`
   in `src/assets/styles/fonts.css`. The Nerd Font is the _global_ UI font
   (`page.css` sets it `!important`; the default theme `fontFamily` in
   `src/store/variables.ts` / `App.vue` falls back to it), so every visitor
   pays the full download. Additionally, `fonts.css` line 1 does a
   render-blocking remote `@import` of `Ndot 57 Aligned` from
   `db.onlinewebfonts.com` — a third-party request on the critical path.
2. **ECharts (517 KB) loads on every page.** `src/main.ts` eagerly imports
   `echarts/core` (renderer + Bar/Line/Pie + 4 components), calls `use()`,
   and registers `vue-echarts` globally — yet only three components ever
   render charts (`TempChart`, `HistoryAllPrintStatusChart`,
   `HistoryPrinttimeAvg`). Lighthouse flags ~1.6s of unused-JS savings.
3. **Vuetify ships un-treeshaken.** `src/main.ts` does
   `import * as components from 'vuetify/components'` plus the full
   `import 'vuetify/styles'` (511 KB CSS, 514 KiB flagged unused, ~640ms
   savable). The `unplugin-vue-components` + `Vuetify3Resolver` in
   `vite.config.ts` auto-imports SFC usage, but the barrel import in
   `main.ts` defeats treeshaking for the whole library.
4. **Dead weight: `echarts-gl`.** `package.json` depends on it, but the only
   reference in `src/` is `src/types/echarts-gl.d.ts` (a type shim) — no
   runtime import. It should be verified and removed.
5. **Only one route is code-split.** In `src/routes/index.ts` only
   `Viewer.vue` uses `() => import()`; every other page joins the initial
   chunk. Heavy viewers (`@sindarius/gcodeviewer`, CodeMirror — for which a
   `CodemirrorAsync.vue` precedent already exists) ride along on first paint.
6. **Accessibility failures (score 72).** `link-name`, `button-name`, and
   `label` audits fail — icon-only `v-btn`/links without discernible names
   and unlabeled form elements.

## 2. Goals

1. Cut total first-load transfer from 7.9 MB to **< 3 MB** (fonts alone
   should drop from 4.7 MB to **< 800 KB**).
2. Defer ECharts (and other route-only heavies) off the initial chunk so
   unused-JS savings approach zero on the dashboard route.
3. Ship trees shaken Vuetify (JS + styles) with no visual regressions.
4. Raise Lighthouse a11y to **≥ 90** and performance to **≥ 70** on the same
   mock-backed desktop run.
5. Keep the Nerd Font icon glyphs working everywhere (subset, don't drop).

## 3. Non-Goals

- No visual redesign or font-family change (0xProto Nerd Font stays).
- No full-fidelity device testing (Pi touchscreen numbers will differ; the
  mock-backed desktop run is the repeatable gate).
- No Lighthouse CI job in this PR (flake-prone on shared runners; R6 keeps
  it a documented local gate — a CI job is a follow-up).
- No snapshot/DOM restructuring of components for CLS (CLS is already 0).

## 4. Decision

Adopt a **subset-and-defer** strategy: woff2 + `unicode-range` subsetting
for fonts (R1), lazy-init for ECharts (R2), `vite-plugin-vuetify` for
treeshaking (R3), per-route lazy imports (R4), and named-control fixes plus
a lint guard for a11y (R5). Each requirement is independently shippable and
lands with a before/after Lighthouse note in the progress log (§10).

Reference run for all before/after comparisons:

```sh
npm run build
node mock-moonraker.cjs &          # serves dist/ same-origin on :7125
lighthouse http://127.0.0.1:7125/ --preset=desktop \
  --chrome-flags="--no-sandbox --disable-gpu" \
  --output=json --output=html --output-path=/tmp/mainsail-lh
```

## 5. Requirements

### R1 — Subset and self-host fonts (biggest win: ~4 MB)

- Convert `public/fonts/0xproto/*.ttf` (Regular, Bold, Italic) to **woff2**,
  split by `unicode-range` into at least two subsets per weight: **latin**
  (U+0000–00FF and friends) and **nerd-symbols** (private-use + extended
  codepoints the UI actually uses), so the browser downloads icon glyphs
  only when rendered text needs them. Keep TTF files until R1 is verified,
  then delete them.
- Rewrite the `@font-face` blocks in `src/assets/styles/fonts.css` with the
  woff2 sources + `unicode-range` descriptors (`font-display: swap` is
  already set — keep it).
- **Self-host `Ndot 57 Aligned`**: download the woff2, serve from
  `public/fonts/`, and delete the remote `@import` line in `fonts.css`
  (render-blocking third-party request on the critical path).
- Verify: Nerd Font icons render in console/MDI/file-browser views;
  Lighthouse `font-display` audit stays green; font transfer < 800 KB.

### R2 — Lazy-load ECharts (saves ~517 KB up front)

- Remove the eager `echarts/core` imports, the `use([...])` call, and the
  global `EChart` registration from `src/main.ts`.
- Initialize ECharts inside the three chart components (`TempChart.vue`,
  `HistoryAllPrintStatusChart.vue`, `HistoryPrinttimeAvg.vue`): dynamic
  `import('echarts/core')` + `use()` on mount (or `defineAsyncComponent`
  for `vue-echarts`), so the already-split `echarts-*` chunk (see
  `vite.config.ts` `manualChunks`) loads only when a chart mounts.
- Verify `echarts-gl` has no runtime import (today only
  `src/types/echarts-gl.d.ts` references it); if confirmed, drop it from
  `package.json` dependencies.
- Done when the dashboard route's Lighthouse run shows no `echarts-*`
  chunk in the transfer list and charts still render on their routes
  (history/temperature views, covered by the R5 page-smoke e2e).

### R3 — Treeshake Vuetify (saves ~500 KB CSS + unused JS)

- Replace the barrel `import * as components from 'vuetify/components'`
  (+ `vuetify/directives`) and the full `import 'vuetify/styles'` in
  `src/main.ts` with **`vite-plugin-vuetify`** (automatic treeshaking +
  style auto-import), reconciling it with the existing
  `unplugin-vue-components` + `Vuetify3Resolver` setup (remove the
  redundancy, don't stack both).
- Audit dynamic component usage first (`<component :is="...">` with
  `V*` names, programmatic dialogs) — anything the static analyzer can't
  see must be allow-listed or converted to explicit imports so it doesn't
  silently disappear.
- Done when unused-CSS savings in Lighthouse drop to ~0 and a visual pass
  over dashboard/console/files/settings shows no missing components or
  unstyled controls. `vite.config.ts` `manualChunks` keeps the `vuetify`
  chunk split.

### R4 — Code-split all routes (defers gcodeviewer/CodeMirror)

- Convert every eager page import in `src/routes/index.ts` to
  `() => import(...)` (only `Viewer.vue` is lazy today).
- Confirm the heavy viewers stay off the initial chunk: verify
  `@sindarius/gcodeviewer` and `codemirror` chunks load only on their
  routes; follow the existing `CodemirrorAsync.vue` async pattern where a
  component is needed inside an otherwise-light page.
- Done when the dashboard route transfers no `gcodeviewer`/`codemirror`
  bytes and every route still mounts (existing `cnc-mock.cy.ts` page-smoke
  pass covers this).

### R5 — Fix accessibility failures (72 → ≥ 90)

- Fix the three failing audits: give every icon-only link/button a
  discernible name (`aria-label` on icon-only `v-btn`s / `a > v-icon`
  without text) and associate every form element with a `label`
  (or `aria-label`/`aria-labelledby` where a visible label is wrong).
- Add a lint guard so it doesn't regress: enable an a11y rule set for
  `src/**/*.vue` (e.g. `eslint-plugin-vuejs-accessibility`, warn-first if
  the legacy list is noisy — same ratchet pattern as the `any` rule).
- Done when the reference Lighthouse run scores a11y ≥ 90 with zero
  `link-name` / `button-name` / `label` failures.

### R6 — Re-measure and record (gate stays local)

- After each of R1–R5, re-run the §4 reference command and append a
  before/after line to the progress log (§10): scores, FCP/LCP/TBT, and
  total transfer.
- Add an `npm run perf` script (or `docs/` note) encoding the §4 command
  so the gate is one command, not tribal knowledge.
- No CI job in this PR (see Non-Goals); if a CI job is wanted later, it
  gets its own follow-up with budgets + allowed-flake policy.

## 6. Deliverables

| File                             | Change                                                                    |
| -------------------------------- | ------------------------------------------------------------------------- |
| `public/fonts/0xproto/`          | `.ttf` → subsetted `.woff2` (+ self-hosted Ndot 57)                       |
| `src/assets/styles/fonts.css`    | woff2 sources + `unicode-range`, no remote `@import`                      |
| `src/main.ts`                    | no eager echarts / no Vuetify barrel import                               |
| `src/components/charts/*.vue`    | lazy ECharts init on mount                                                |
| `package.json`                   | drop `echarts-gl` (if verified unused); add `vite-plugin-vuetify`         |
| `vite.config.ts`                 | `vite-plugin-vuetify` wiring (replacing redundant resolver if applicable) |
| `src/routes/index.ts`            | all pages lazy-imported                                                   |
| icon-only controls across `src/` | `aria-label`s / associated labels                                         |
| `eslint.config.mjs`              | a11y rule set for `*.vue`                                                 |
| `package.json` (scripts)         | `perf` script encoding the §4 reference run                               |

## 7. Acceptance Criteria

1. Reference Lighthouse run (desktop, mock-backed prod build): performance
   **≥ 70**, accessibility **≥ 90**, best-practices still 100, no
   regressions in the `npm run` quality gates (`lint` 0 errors,
   `format:check`, `typecheck`, `test:unit`, `test:coverage`).
2. Total transfer **< 3 MB**; font transfer **< 800 KB**; `echarts-*`,
   `gcodeviewer`, and `codemirror` chunks absent from the dashboard route's
   transfer list.
3. Charts render on temperature/history views; Nerd Font icons render
   everywhere; mock-backed Cypress suite (`cnc-mock.cy.ts`, incl. the
   per-page smoke pass) stays green.
4. Each requirement's before/after numbers are logged in §10.

## 8. Risks & Mitigations

- **Subsetting drops an icon glyph somewhere obscure** — _Mitigation:_ keep
  the nerd-symbols subset generous (full Nerd Font PUA ranges, not a
  per-glyph allow-list); visual pass over console/MDI/file views; TTFs stay
  in git history for instant revert.
- **`vite-plugin-vuetify` breaks a dynamically-resolved component** —
  _Mitigation:_ R3's `<component :is>` audit first; land R3 alone and run
  the full Cypress suite before proceeding.
- **Lazy echarts flashes/loading state** — _Mitigation:_ charts live below
  the fold on their pages; a skeleton/spinner on first mount is acceptable
  and should match existing async patterns (`CodemirrorAsync.vue`).
- **Threshold gaming (chasing the score, not the UX)** — _Mitigation:_
  acceptance is transfer-bytes + route-level chunk absence, not just the
  score; Pi-class hardware benefits from bytes regardless of score timing.

## 9. Open Questions

- Whether `unplugin-vue-components` + `Vuetify3Resolver` stays alongside
  `vite-plugin-vuetify` or is removed — decide during R3 implementation
  (don't run both resolvers on the same components).
- Whether a Lighthouse CI job with performance budgets is wanted after
  this PRD lands — deferred follow-up by design.

## 10. Progress log

- _Baseline (desktop preset, prod `dist/`
  via `mock-moonraker.cjs` same-origin): perf **36**, a11y **72**, BP 100,
  SEO 82; FCP 4.9s · LCP 7.3s · TTI 7.3s · TBT 449ms · CLS 0; total
  **7.9 MB** (fonts 4.7 MB TTF, index JS 1.2 MB, vuetify JS 561 KB,
  echarts JS 517 KB, vuetify CSS 511 KB, vue-core 206 KB); unused-JS
  ~1.6s, unused-CSS ~640ms (514 KiB). Full report from the audit run is
  not committed (regenerate with the §4 command)._
- **2026-10-08 — R1 done:** subsetted webfonts live. `scripts/subset-fonts.sh`
  (needs `pip install fonttools brotli`) splits each 0xProto weight into
  `latin` (44 KB woff2, incl. latin-ext/vietnamese) + `symbols` (876 KB
  woff2, full Nerd PUA + box-drawing) with matching `unicode-range` faces in
  `src/assets/styles/fonts.css`; full TTFs moved to `scripts/font-sources/`
  so `public/` (and `dist/`) carries only subsets. Italic face deleted
  (nothing used it). `Ndot 57 Aligned` self-hosted as 4.2 KB woff2
  (`public/fonts/ndot/`); remote onlinewebfonts `@import` removed. Verified
  in headless Chromium: dashboard downloads only the two latin subsets
  (88 KB vs 4.7 MB), Ndot loads on demand, zero console/page errors.
  Re-run (§4 command): perf **36 → 44**, FCP 4.9s → 3.3s, LCP/TTI
  7.3s → 3.9s, total **7.9 MB → 3.3 MB**; a11y unchanged at 72 (R5's job).
  `lint` 0 errors, `typecheck` clean, `prettier --check .` clean. Pushed as
  `7eba7942`; CI green (Build, Vitest, Code Style, both E2E). Next: R2
  (ECharts lazy-load — the largest remaining unused-JS chunk).
- **2026-10-08 — R2 done:** ECharts out of the critical path. New
  `src/components/charts/echarts-setup.ts` owns the `use([...])`
  registration and re-exports `EChart`; `main.ts` no longer imports
  echarts or registers a global `EChart`, and the three chart components
  (`TempChart`, `HistoryAllPrintStatusChart`, `HistoryPrinttimeAvg` — whose
  only echarts imports were `import type`) import it locally. `TemperaturePanel`
  loads `TempChart` via `defineAsyncComponent` when `boolTempchart` is true;
  `History.vue` loads the whole `HistoryStatisticsPanel` the same way on
  route enter; both show a `VSkeletonLoader` placeholder past the 200ms
  loading delay (TempChart's reserves `tempchartHeight` to avoid CLS).
  Build emits `echarts-*.js` (529 KB) as an async chunk alongside tiny
  `TempChart`/`HistoryStatisticsPanel`/`echarts-setup` chunks. Verified in
  headless Chromium: dashboard requests zero chart chunks; History route
  loads panel + echarts chunks and renders charts with no errors. New spec
  `tests/components/panels/TemperaturePanelAsyncChart.spec.ts` proves the
  async boundary (chart renders incl. real EChart; nothing loads when
  disabled) — full suite 148 files / 1561 tests green. Re-run (§4 command):
  perf **44 → 51**, FCP 3.3s → 2.8s, LCP/TTI 3.9s → 3.35s, TBT 407 → 339ms,
  total **3.3 MB → 2.7 MB**. a11y still 72 (R5). Next: R3 (vuetify
  tree-shaking — the largest remaining chunk at ~1.2 MB index JS).

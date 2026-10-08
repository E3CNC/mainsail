# PRD: Full Coverage Closure for the Remaining 85%

- **Status:** Proposed
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-08
- **Scope:** `tests/`, `cypress/`, `vite.config.ts`, `.github/workflows/ci.yml`, `src/store/`, `src/directives/`, `src/components/`, `src/pages/`

## 1. Problem

The coverage-expansion PRD (`docs/prd/test-coverage-expansion.md`) is complete
(2026-10-07) and closed its scope:

- **Unit:** 45 spec files, 317 tests, all green.
- **Global:** `src/` has **401 files / ~31k statements** at **15.15% line
  coverage** (up from 5.4%), **63.9% functions**, **84.5% branches**.
- **Gate:** `vite.config.ts` uses scoped CNC floors plus a low global backstop
  (lines/statements 5, functions 50, branches 80). `npm run test:coverage`
  passes, and the `vitest` CI job gates on it.

The remaining ~85% of lines fall in layers the prior PRD explicitly deferred:

- **`src/components/` — 208 files, 0%.** All Vuetify views, including the
  CNC panels (`DroPanel`, `JogPanel`, `MdiPanel`, `Wcs`, `SpindleCoolantPanel`,
  `CncStatusPanel`, `HostBashPanel` + `wcsPreview.ts` + `jogKeyboard.ts`),
  plus `panels/`, `dialogs/`, `inputs/`, `console/`, `settings/`, `webcams/`,
  `charts/`, `ui/`, and `The*` app chrome.
- **`src/pages/` — 10 files, 0%.** Thin route wrappers (`Dashboard` 166 lines,
  `Console` 151 lines, `Files`, `Machine`, `History`, `Viewer`, `Timelapse`,
  `Farm`, `Webcam`, `PageNotFound`).
- **`src/directives/` — 2 files, 0%.** `longpress.ts` (111 lines),
  `responsive-class.ts` (28 lines).
- **`src/store/` remainder — ~80 files at 0-40%.** Untested: `socket/` (5),
  `files/` non-CNC (`actions`/`getters`/`mutations`/`index`, 4),
  `printer/getters.ts` (14.7%, ~700 uncovered lines), `editor/` (4 logic
  files), `farm/` + `farm/printer/` (7), `gcodeviewer/` (4), `gui/` root +
  10 submodules (`console`, `gcodehistory`, `macros`, `maintenance`,
  `miscellaneous`, `navigation`, `notifications`, `reminders`,
  `remoteprinters`, `webcams` — current 10-48% is import side-effects, not
  real assertions), store root (`actions`/`getters`/`index`/`mutations`, 4).
  Partially covered and worth closing: `printer/tempHistory/*` (81-82%),
  `server/actions.ts` (88%), `server/mutations.ts` (78%).
- **Explicitly out of unit scope (no work):** `src/plugins/**`,
  `src/types/**`, `src/routes/**`, `src/main.ts`, `src/store/runtime.ts`,
  `src/store/variables.ts` — already excluded in `vite.config.ts`
  `coverage.exclude`.

Without this follow-up there is no plan for the long tail: the global floor
stays at 5%, component regressions ship silently, and every future "raise the
floor" change is an unscoped big bang.

## 2. Goals

1. Close the store-logic tail to >=90% on every `src/store/**` logic file
   (actions/getters/mutations), so machine and UI state are regression-safe.
2. Cover the 2 directives (cheap, high value).
3. Cover CNC components first with behavior assertions, then decide the
   fate of the remaining 200 components (unit vs e2e vs exclusion).
4. Cover pages via mock-backed Cypress rather than unit mounts (they are
   route wrappers, not logic).
5. Keep `ci.yml` green throughout; ratchet the coverage gate upward per
   phase instead of one unreachable jump.

## 3. Non-Goals

- No 85%-to-100% big bang in one change. Phases are independently shippable;
  each phase raises the floor it owns.
- No component snapshot testing (low value for Vuetify-heavy views; assert
  on store/composable state and emitted commands, not DOM, per existing
  convention).
- No full-fidelity Klipper in CI (still out of scope per harness PRD).
- No change to the release workflow or hardware behavior; test-only work.
- No change to already-excluded paths (`plugins`, `types`, `routes`,
  `main.ts`, `runtime.ts`, `variables.ts`).

## 4. Decision

Adopt a **logic-first, CNC-first ratchet**, mirroring the prior PRD's
scoped-floor strategy:

- Store + directives first (fast jsdom tests, deterministic).
- CNC components second (the fork's differentiator).
- Generic components and pages last, with an explicit unit-vs-e2e split so
  the PRD cannot stall on 200 Vuetify mounts.
- After each phase, raise the matching threshold in `vite.config.ts` so
  backsliding fails `npm run test:coverage`.

## 5. Requirements

### R1 — Make the gate ratchet-ready

In `vite.config.ts` (`coverage.thresholds`):

- Raise the global backstop from lines/statements 5 to **15** (matches
  today's 15.15% reality) so a regression fails immediately.
- Add scoped floors for the newly covered `server/*` + `printer/*` layer
  (e.g. lines/functions/statements 80, branches 70), mirroring the existing
  `cnc*` and `mockMoonrakerDb` blocks.
- Each phase below (R2-R5) must bump the floor it owns in the same change
  that adds the specs. Document the strategy where the R1 block already
  lives (the "Ratchet upward as coverage phases land" comment).

### R2 — Phase 1: store-logic closure (highest value)

Add Vitest specs under `tests/store/` following the existing jsdom setup:

1. `socket/` actions/getters/mutations (connection state; mock the socket).
2. `files/` non-CNC actions/getters/mutations (seed via `mockMoonrakerDb`).
3. `printer/getters.ts` (largest single gap; split the spec by getter
   group if one file gets unwieldy).
4. `gui/` root + submodules in priority order: `console`, `gcodehistory`,
   `macros`, `navigation`, `miscellaneous`, `webcams`, then `maintenance`,
   `notifications`, `remoteprinters`, `reminders`. (`presets/` is types-only;
   record a written exclusion like `useToast.ts`.)
5. `editor/`, `farm/` + `farm/printer/`, `gcodeviewer/`, store root.
6. Top up partials: `printer/tempHistory/*`, `server/actions.ts`,
   `server/mutations.ts` to >=95%.

Done when every `src/store/**` logic file is either >=90% lines or carries
a written exclusion. Target: global lines 15% -> ~22%.

### R3 — Phase 2: directives (cheap win)

- `tests/directives/longpress.spec.ts`: press duration, movement cancel,
  unmount cleanup (fake timers).
- `tests/directives/responsive-class.spec.ts`: class toggling on breakpoint
  change.
- Done when both files are >=90%. No threshold change needed beyond R1
  backstop (2 small files).

### R4 — Phase 3: components, CNC-first

CNC panels are the fork's differentiator and the only components worth
full unit behavior tests:

- `tests/components/cnc/*.spec.ts` for `DroPanel`, `JogPanel`, `MdiPanel`,
  `Wcs` (+ `wcsPreview.ts`), `SpindleCoolantPanel`, `CncStatusPanel`,
  `HostBashPanel` (+ `jogKeyboard.ts`).
- Mount with `@vue/test-utils` + stubbed Vuetify; assert on emitted
  commands / store calls / rendered DRO values, not DOM snapshots.
- Add a scoped floor for `src/components/panels/Cnc/*` (>=70% lines) once
  green.

For the remaining ~200 components, explicitly decide per directory and
record it here (no silent deferral):

- `panels/`, `inputs/`, `console/`, `dialogs/` — behavior specs where the
  component owns logic; otherwise e2e smoke.
- `The*` chrome, `settings/`, `webcams/`, `charts/`, `ui/` — default to
  e2e smoke (R5); unit-mount only where logic cannot be observed externally.
- Components with zero unit-testable logic get a written exclusion list in
  this PRD (same precedent as `useToast.ts`), not an open-ended gap.

**Decision recorded 2026-10-08 (no silent deferral):**

- `panels/` (non-CNC), `inputs/`, `console/`, `dialogs/` — behavior specs
  where the component owns logic (command handlers, validation, formatting);
  pure Vuetify layout wrappers go to e2e smoke. Executed as the R4b
  follow-up, same `@vue/test-utils` + stubbed-Vuetify pattern as the CNC
  specs.
- `The*` chrome, `settings/`, `webcams/`, `charts/`, `ui/` — e2e smoke
  (R5 mock suite) by default; unit-mount only where logic cannot be
  observed externally.
- Zero-logic components (pure presentational, no handlers/computed) get a
  written exclusion list appended here during R4b, not an open gap.

**Written exclusion list (27 zero-logic components, all <25 script lines
and no emit/dispatch/socket/timer markers — covered by R5 e2e smoke, not
unit mounts):** `panels/Status/Printstatus.vue`,
`panels/Status/PrintstatusComplete.vue`, `dialogs/DevicesDialogCanDevice.vue`,
`dialogs/DevicesDialogSerialDevice.vue`, `dialogs/DevicesDialogUsbDevice.vue`,
`dialogs/DevicesDialogVideoDeviceLibcamera.vue`,
`dialogs/DevicesDialogVideoDeviceV4l2.vue`, `dialogs/MacroPromptButtonGroup.vue`,
`dialogs/MacroPromptText.vue`, `dialogs/AboutDialog.vue`,
`panels/GcodefilesPanel.vue`, `panels/Machine/LogfilesPanel.vue`,
`panels/Gcodefiles/GcodefilesPanelHeaderSettings.vue`,
`panels/Gcodefiles/GcodefilesPanelHeaderPathSize.vue`,
`panels/Gcodefiles/GcodefilesPanelListCardBack.vue`,
`panels/Machine/SystemPanel.vue`, `panels/Machine/SystemPanelMcu.vue`,
`panels/Machine/EndstopPanelItem.vue`, `panels/Status/Jobqueue.vue`,
`panels/MinSettingsPanel.vue`, `panels/TemperaturePanel.vue`,
`panels/Temperature/TemperaturePanelListItemAdditionalSensor.vue`,
`panels/Miscellaneous/MiscellaneousSensor.vue`,
`panels/Miscellaneous/MoonrakerSensor.vue`, `panels/MiscellaneousPanel.vue`,
`panels/MacrosPanel.vue`, `inputs/CodemirrorAsync.vue`.

**Mid-tier components** (25-100 script lines, few markers: JobqueueEntrySum/
Rest, thumbnails, light groups, temp lists, CSV-adjacent helpers, log
viewers, webcam/settings shells) default to R5 e2e smoke per the decision
above; they are not unit-mounted in R4b.

### R5 — Phase 4: pages via mock-backed e2e

Pages are thin (5-166 lines each). Do not unit-mount them; extend the
mock-backed suite instead:

- Extend `cypress/e2e/cnc-mock.cy.ts` (run against `node mock-moonraker.cjs`)
  with a per-page smoke pass: visit each route, assert mount + seeded
  content + no console errors.
- Keep `cypress/e2e/dashboard.cy.ts` as the harness-backed bootstrap/layout
  anchor (no change unless routes move).
- Done when every route in `src/routes/` is visited by at least one green
  Cypress spec.

### R6 — CI stays green, coverage stays gating

- Keep the `vitest` CI job on `npm run test:coverage` (set by the prior
  PRD's R5); each phase must keep it green.
- Keep the two Cypress jobs (harness-backed + mock-backed) green; R5 adds
  specs to the existing mock job, not a third job.
- Optionally publish the `text-summary` output as a job annotation; no
  artifact upload required.

## 6. Deliverables

| File                                                | Change                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `vite.config.ts`                                    | R1 backstop 5 -> 15 + new `server`/`printer` scoped floors; per-phase bumps for R2-R4 |
| `tests/store/**/*.spec.ts`                          | R2 store-logic closure specs                                                          |
| `tests/directives/*.spec.ts`                        | R3 directive specs                                                                    |
| `tests/components/cnc/*.spec.ts` (+ exclusion list) | R4 CNC component specs + per-directory unit-vs-e2e decision                           |
| `cypress/e2e/cnc-mock.cy.ts`                        | R5 per-page smoke pass against `npm run mock`                                         |
| `.github/workflows/ci.yml`                          | no new jobs; keep coverage + both Cypress jobs green (R6)                             |
| `docs/prd/test-coverage-expansion.md`               | note supersession by this PRD for the remaining tail                                  |

## 7. Acceptance Criteria

1. `npm run test:coverage` passes on a clean checkout after each phase,
   with the phase's threshold bump included in the same change.
2. R2: every `src/store/**` logic file >=90% lines or has a written
   exclusion; no `store/` file below its scoped floor.
3. R3: both directives >=90% lines.
4. R4: all 7 CNC panels + `wcsPreview.ts` + `jogKeyboard.ts` have behavior
   specs green under `npm run test:unit`; remaining component directories
   have a recorded unit-vs-e2e decision.
5. R5: mock-backed Cypress visits every route green locally and in CI.
6. `npm run lint` (0 errors) / `npm run format:check` / `npm run typecheck`
   still pass.

## 8. Risks & Mitigations

- **Boiling the ocean (208 components)** — _Mitigation:_ CNC-first (R4)
  is independently shippable; generic components default to e2e smoke with
  written exclusions instead of 200 mounts.
- **Vuetify mount cost/flake** — _Mitigation:_ stub Vuetify in unit mounts;
  assert on commands/state, not DOM snapshots, per existing convention.
- **Threshold gaming (raising floors looks cosmetic)** — _Mitigation:_
  scoped floors only rise with the specs that earn them in the same change;
  global backstop tracks measured reality (15% now).
- **Mock drift (pages tested against fake Moonraker)** — _Mitigation:_
  `mockMoonrakerDb` already has 100% unit coverage; harness-backed spec
  remains the integration anchor.
- **Printer-getters spec size** — `printer/getters.ts` is the largest gap
  (~700 lines). _Mitigation:_ split the spec by getter group
  (temperatures / toolhead / extruders / gcode_move).

## 9. Open Questions

- None yet. First decision due in R4: per-directory unit-vs-e2e split for
  non-CNC components (default proposed above: e2e smoke except where the
  component owns logic).

## 10. Progress log

- _None — PRD proposed 2026-10-08. Current baseline: 45 spec files,
  317 tests green, global 15.15% lines / 63.9% functions / 84.5% branches._
- **2026-10-08 — R1 done:** global backstop 5 -> 15 (lines/statements) plus
  scoped floors for the `server/*` + `printer/*` layer in `vite.config.ts`;
  `test:coverage` passes.
- **2026-10-08 — R2 done:** store-logic closure. 59 new spec files + 5
  top-ups (socket/, files/ non-CNC, printer/getters via `getters2.spec.ts`,
  gui/ root + 10 submodules, editor/, farm/ + farm/printer/, gcodeviewer/,
  store root, tempHistory/server-actions/server-mutations top-ups,
  power/sensor getters specs). Suite 45 -> 104 files, 317 -> 935 tests
  green. Global lines 15.15% -> 68.22% (backstop raised to 65; functions 95,
  branches 85). Every `src/store/**` logic file >=90% lines.
  Written exclusions: `gui/presets/` (types-only) and all
  `src/store/**/types.ts` (no executable code; zero-statement files do not
  trip glob floors). Floors left intentionally low with cause: `editor/*`
  functions 80 (axios progress callbacks), `server/getters.ts` branches 50
  (lines 124-125), `farm/printer/index.ts` branches 50 (https ternary),
  `socket/index.ts` unfloored (deployment-env branches). Next: R3
  directives.
- **2026-10-08 — R3 done:** `tests/directives/longpress.spec.ts` (10 tests:
  handler forms, debounce, cancel paths, drag guard, selection lock,
  cleanup) + `tests/directives/responsive-class.spec.ts` (2 tests: class
  toggling, disconnect). Suite 104 -> 106 files, 935 -> 947 tests green.
  Both directives at 100% lines (no threshold change needed). Next: R4
  CNC components.
- **2026-10-08 — R4 done:** CNC component behavior specs.
  `tests/components/cnc/` gains DroPanel (16), CncStatusPanel (26),
  JogPanel (33), MdiPanel (10), jogKeyboard (11), Wcs (29, incl.
  wcsPreview), SpindleCoolantPanel (18), HostBashPanel (18) — 161 tests
  asserting exact gcode payloads (G91/G1 jog, G28, M18, M112, M220,
  G54-G59, spindle/coolant states), WCS select/zero flows, MDI echo, and
  DRO/status rendering. All 9 Cnc files at 96-100% lines; scoped floor
  `src/components/panels/Cnc/*` added at 90/70/70/90. Suite 106 -> 114
  files, 947 -> 1108 tests green; global lines 68.22% -> 69.16%.
  Non-CNC unit-vs-e2e decision recorded in R4 above; R4b (non-CNC
  behavior specs) is the remaining component work. Next: R4b.
- **2026-10-08 — R4b done:** 31 non-CNC behavior specs (32 files incl.
  ConfigFilesPanel2) + HistoryListPanelExportCsv — 447 agent tests + 4
  own tests. Targets: ConfigFilesPanel, history cluster (7), file-browser
  cluster (8 + ExportCsv), inputs cluster (7 + neopixel dialog), status/misc
  cluster (7). All targets >=70% lines (lowest: Codemirror 74.83).
  Suite 114 -> 147 files, 1108 -> 1555 tests green. Global lines
  69.16% -> 70.35%; global functions recalibrated 95 -> 85 (mounted SFCs
  contribute ~600 template functions — locked instead by per-directory R4b
  floors). 27 zero-logic components recorded in the exclusion list above.
  New bug-shaped findings (all fixed 2026-10-08 in `b776eadf`, specs updated
  to the corrected behavior — see the post-R6 entry below):
  HistoryListPanel dropped all maintenance rows on the `.gcode` filter,
  HistoryEntry `statusColor` returned an icon path, JobqueueEntry
  `filamentWeight` kg branch threw on undefined `length`, Wcs manual
  offsets were write-only, plus dead `clippedMin/Max` and unreachable 3-digit
  `hexToRgba`. Harness note: stubs that `$emit` a parent-listened event
  MUST declare `emits`, else the listener fires twice (native fallthrough).
- **2026-10-08 — R5 done:** `cypress/e2e/cnc-mock.cy.ts` gains a 10-test
  "Page smoke pass" visiting every route in `src/routes/` against a fresh
  `npm run mock`: `/` (dro-panel), `/allCncMachines` ("No machines
  registered"), `/cam` (.webcam-panel), `/console` (MDI field), `/files`
  (seeded benchy), `/viewer` (.gcode-viewer-panel), `/history` (statistics
  and list vs zeroed mock totals), `/timelapse` (files + status panels),
  `/config` (.machine-configfiles-panel), plus `/settings/machine` ->
  `/config` redirect. Each asserts mount + seeded content + stubbed
  `console.error` never called. Suite 6 -> 16 tests, all green locally
  (45s headless) and added to the existing mock CI job (no new job, no
  `ci.yml` change). `PageNotFound.vue` is dead code — no route references
  it and there is no catch-all — recorded here as excluded, not visitable.
  No vitest floor change (e2e does not move unit coverage). Harness notes:
  (1) local headed runs flaked on `cy.screenshot()` timeouts masking real
  errors — reran with `screenshotOnRunFailure=false` to see truth; CI uses
  its own runner and is unaffected. (2) The pre-existing DRO test asserts
  X=100 and is order/state-sensitive: the jog test mutates shared mock
  state, so a spec run against a reused mock fails DRO with 101 — always
  run against a fresh mock (CI does). Next: R6 CI verification.
- **2026-10-08 — R6 done:** all five CI jobs green on the current tree.
  The R5 commit's run failed Code Style only (prettier-mangled `+ list`
  line in this PRD — fixed in the follow-up commit); Build, Vitest
  (coverage floors), E2E Mock CNC (incl. the 10 new smoke tests), and E2E
  Docker harness all passed. The fix commit's run is fully green. PRD
  complete: R1 gate, R2 store, R3 directives, R4/R4b components, R5 pages,
  R6 CI green with no new jobs.
- **2026-10-08 — Post-R6 bug fixes (`b776eadf`):** closed the four
  bug-shaped findings from R4b, specs updated to corrected behavior (+4
  tests, suite 1555 -> 1559 green, global lines 70.35% -> 70.37%, all gates
  green): (1) HistoryListPanel `.gcode` filter no longer drops maintenance
  rows (jobs still extension-filtered); (2) HistoryEntry `statusColor` uses
  `convertPrintStatusIconColor`; (3) JobqueueEntry kg branch uses `weight`
  (was a `ReferenceError` past 1000 g); (4) Wcs gains an Apply button
  sending manual X/Y/Z via `selectCncWcs` `offsets` + refresh (mock
  `wcs/select` honors `offsets`; verified live round-trip), dead
  `clippedMin/Max` fields and 3-digit `hexToRgba` branch removed. E2E
  re-run 16/16 green against rebuilt `dist/`. Remaining accepted gaps:
  mid-tier components (neither unit nor e2e — see R4 decision), dead
  `PageNotFound.vue` (candidate for deletion).

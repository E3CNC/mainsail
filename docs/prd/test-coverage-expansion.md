# PRD: Test Coverage Expansion Beyond the CNC Layer

- **Status:** Superseded by `docs/prd/full-coverage-closure.md` (2026-10-08),
  which closed the remaining ~85% tail this PRD deferred. This document is
  retained as history; do not extend it.
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-07
- **Scope:** `tests/`, `cypress/`, `vite.config.ts`, `.github/workflows/ci.yml`, `docs/prd/ci-e2e-and-cnc-coverage.md`

## 1. Problem

The e2e + CNC coverage PRD (`docs/prd/ci-e2e-and-cnc-coverage.md`) scoped unit
work to the CNC-critical layer and explicitly deferred threshold enforcement:

> "No coverage threshold enforcement (a floor is a follow-up)."

That follow-up is now due. Current state (2026-10-07):

- **Unit:** 8 spec files, 79 tests, all green. The 5 CNC-critical files sit at
  87–100% coverage.
- **Global:** `src/` has **401 files / ~31k statements** at **5.4% line
  coverage**. 14 of 19 composables, nearly all store modules (except
  `cncApi`/`cncMetadata`/`printer/getters`), `utils/cfgValidator.ts`, and all
  205 components are untested.
- **Gate mismatch:** `vite.config.ts` declares global thresholds (65% lines /
  statements, 55% functions, 75% branches) that `npm run test:coverage` fails
  today (5.4% / 52% / 86% branches). CI runs `test:unit` (no thresholds), so
  the mismatch is silent — but anyone running `test:coverage` locally gets a
  red build with no path to green.
- **E2E gap:** 1 Cypress spec (3 tests) against the Docker harness, asserting
  only SPA mount + layout + Klipper-disconnected banner. The prior PRD's R2
  (jog / MDI / WCS / file browser assertions) was never closed: real Moonraker
  has no Klipper and no `/server/cnc/*` endpoints, so those interactions need a
  **mock-backed** spec that was never written.

## 2. Goals

1. Make the coverage gate honest: thresholds developers can actually pass, with
   a ratchet that prevents backsliding on the CNC layer.
2. Expand unit coverage beyond CNC in priority order (logic first, components
   last).
3. Close the prior PRD's R2 gap with mock-backed Cypress specs for the
   CNC interactions the harness cannot exercise.
4. Keep `ci.yml` green throughout; coverage stays informational until floors
   are met.

## 3. Non-Goals

- No 65%-global-coverage big bang. The 401-file backlog closes incrementally;
  this PRD sets the mechanism, not the finish line.
- No component snapshot testing (low value for Vuetify-heavy views; assert on
  store/composable state, not DOM, per existing convention).
- No full-fidelity Klipper in CI (still out of scope per harness PRD).
- No change to the release workflow.

## 4. Decision

Adopt a **scoped-floor + ratchet** strategy instead of the current unreachable
global thresholds, paired with phased unit expansion and mock-backed e2e:

- Replace the single global gate with per-path floors that match reality today
  and ratchet upward as phases land.
- Expand units in three phases (composables → store → utils), deferring the
  205 components until the logic layer is solid.
- Add a second Cypress spec run against `npm run mock` for CNC interactions.

## 5. Requirements

### R1 — Make the coverage gate honest

In `vite.config.ts` (`coverage.thresholds` + `coverage.watermark` if used):

- Option A (adopted 2026-10-07): **scoped floors** — high CNC floors plus a low global backstop, ratcheted upward per phase.
- Either way: `npm run test:coverage` must pass on a clean checkout after this
  PRD lands. Document the chosen strategy in a `coverage/README` comment or
  `agent_docs/` note so the next phase knows how to raise the floor.

### R2 — Phase 1: untested composables (highest value)

Add Vitest specs for the logic-heavy, currently untested composables
(`src/composables/` — 14 untested of 19). Priority order:

1. `useConsole.ts`, `useControl.ts` (command paths to the machine),
2. `useGcodeFiles.ts`, `useSocket.ts` (data flow),
3. remainder (`useDashboard`, `useHistory`, `useMiscellaneous`,
   `useNavigation`, `useResponsive`, `useServices`, `useSettingsDatabase`,
   `useTheme`, `useTimelapse`, `useToast`, `useWebcam`, `useBase`).

Target: each spec asserts on composable state, not DOM. Phase done when every
composable has a spec or a written justification for exclusion.

**Done 2026-10-07:** all 19 composables covered — 18 specs
(`tests/composables/*.spec.ts`, 100 new tests, suite 79 → 179 green) plus one
written exclusion: `useToast.ts` exports only a `ToastPlugin` installer wrapping
a lazy dynamic `import('vue-toast-notification')` — no unit-testable logic;
covered by build. Global line coverage rose 5.4% → 9.4%.

### R3 — Phase 2: store + utils

- Store modules under `src/store/` with zero coverage today: `printer`
  (beyond `getters`), `server/*`, `socket`, `gui`, `farm`, `editor`,
  `gcodeviewer`, `files` (beyond cnc). Priority: `printer/*` (machine state),
  then `server/*`, then the rest.
- `src/utils/cfgValidator.ts` (0% — validation logic is cheap to test, high
  value).
- Follow existing `tests/` jsdom setup.

### R4 — Mock-backed Cypress specs (closes prior PRD R2 gap)

Add `cypress/e2e/cnc-mock.cy.ts` (or equivalent) run against
`npm run mock` (fake Moonraker on 127.0.0.1:7125 with `/server/cnc/*`), asserting:

- jog panel issues commands (observable via mock state),
- MDI console accepts and echoes input,
- WCS preview / DRO renders machine state,
- file browser lists seeded gcodes.

Wire as a second Cypress step (or second spec in the same run) so both suites
execute: harness-backed (integration reality) + mock-backed (CNC behavior).
Update `docs/prd/ci-e2e-and-cnc-coverage.md` R2 to record that harness specs
cover bootstrap/layout while CNC interactions live in the mock spec.

### R5 — CI stays green, coverage stays informational

- `ci.yml` `vitest` job keeps running `npm run test:unit` (no threshold gate)
  until Phase 1 lands; then switch it to `npm run test:coverage` so the
  scoped floors (R1) actually gate.
- Optionally publish the text-summary output as a job annotation; no artifact
  upload required.

## 6. Deliverables

| File                                          | Change                                               |
| --------------------------------------------- | ---------------------------------------------------- |
| `vite.config.ts`                              | scoped floors or lowered globals (R1)                |
| `tests/composables/*.spec.ts`                 | Phase 1 specs (R2)                                   |
| `tests/store/**/*.spec.ts`, `tests/*.spec.ts` | Phase 2 specs (R3)                                   |
| `cypress/e2e/cnc-mock.cy.ts`                  | mock-backed CNC assertions (R4)                      |
| `.github/workflows/ci.yml`                    | second Cypress target; coverage gate when ready (R5) |
| `docs/prd/ci-e2e-and-cnc-coverage.md`         | update R2 to reflect harness/mock split (R4)         |

## 7. Acceptance Criteria

1. `npm run test:coverage` passes on a clean checkout (R1).
2. CNC-critical files retain ≥85% line coverage (no backsliding).
3. Phase 1: every composable has a spec or a written exclusion; suite runs
   green under `npm run test:unit`.
4. New mock-backed Cypress spec passes locally against `npm run mock` and in
   CI, asserting jog, MDI, WCS/DRO, and file listing.
5. `npm run lint` (0 errors) / `npm run format:check` / `npm run typecheck`
   still pass.

## 8. Risks & Mitigations

- **Boiling the ocean** — 401 files is a big backlog. _Mitigation:_ phases are
  independently shippable; Phase 1 alone is a meaningful win. Components
  explicitly deferred.
- **Threshold gaming** — lowering globals can look like giving up.
  _Mitigation:_ scoped CNC floors are set high (≥85–90%); globals are a
  backstop, ratcheted upward per phase, with the strategy documented.
- **Mock drift** — mock-backed e2e asserts against `mock-moonraker.cjs`, not
  real Moonraker. _Mitigation:_ `mockMoonrakerDb` already has 100% unit
  coverage; the harness-backed spec remains as the integration anchor.
- **Cypress flake (two targets)** — _Mitigation:_ mock target uses the
  deterministic fake Moonraker with seeded state and bounded waits, same
  pattern as the harness spec.

## 9. Open Questions

_None — resolved 2026-10-07: scoped floors (R1), start with R1 gate fix, Phase 2 starts with `printer/*`._

## Progress log

- **2026-10-07 — R1 done:** scoped CNC floors + low global backstop in
  `vite.config.ts`; `test:coverage` passes (was failing).
- **2026-10-07 — Phase 1 done:** all 19 composables covered — 18 specs
  (`tests/composables/*.spec.ts`, suite 79 → 179 green); `useToast.ts`
  excluded with justification (plugin installer, lazy dynamic import).
  Global line coverage 5.4% → 9.4%.
- **2026-10-07 — Phase 2 (`printer/*`) done:** `printer/` getters (pre-existing),
  actions, mutations + `tempHistory/` actions, getters, mutations — 6 files,
  56 tests. Suite 179 → 220 green across 29 files. Global line coverage
  9.4% → 11.0%. Next: `server/*` store.
- **2026-10-07 — Phase 2 (`server/*` + utils) done:** `server/` core
  (actions/getters/mutations) + `history/`, `jobQueue/`, `power/`, `sensor/`,
  `timelapse/` submodules + `utils/cfgValidator.ts`. Suite 220 → 317 green
  across 45 files. Global line coverage 11.0% → 15.2% (after removing
  router import-theater from two specs; raw import-all number was 53%).
- **2026-10-07 — R4 done:** `cypress/e2e/cnc-mock.cy.ts` (layout, DRO,
  jog→DRO, MDI echo, WCS select, seeded files) run against
  `node mock-moonraker.cjs`, which now also serves `dist/` same-origin and
  seeds `benchy_pla.gcode` + file metadata. New `E2E (Mock CNC)` CI job;
  harness job pinned to `dashboard.cy.ts`.
- **2026-10-07 — R5 done:** `ci.yml` `vitest` job switched from
  `test:unit` to `test:coverage` so the scoped floors gate.
- **2026-10-07 — R4 verified green:** fixed two CI-only issues (mock job
  needed `baseUrl` override; MDI input selector matched a hidden mirror
  textarea). CI run 37634493292: all 5 jobs green, 6/6 mock specs passing.
  All acceptance criteria met — PRD complete.
- **2026-10-08 — Superseded:** `docs/prd/full-coverage-closure.md` proposed,
  executed (R1–R6), and closed: store-logic closure, directives, CNC + 31
  non-CNC component specs, per-page mock e2e smoke, CI green with no new
  jobs. Suite 45 files / 317 tests → 147 files / 1559 tests (+4 bug-fix
  tests), global lines 15.2% → 70.4%. See that PRD for floors, exclusion
  lists, and the follow-up bug fixes.

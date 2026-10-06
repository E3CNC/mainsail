# PRD: Docker Harness E2E in CI + CNC-critical Vitest coverage

- **Status:** Accepted
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-06
- **Scope:** `.github/workflows/ci.yml`, `tests/`, `cypress/`, `mock-moonraker.cjs`

## 1. Problem

CNC UI bugs are high-consequence (controls real machines), yet test coverage is
thin: **4 Vitest spec files** (`tests/`) and **1 Cypress spec**
(`cypress/e2e/dashboard.cy.ts`) covering ~250 source files. The one e2e spec
only asserts a "Connecting to localhost" splash — it never exercises jog, DRO,
WCS offsets (G54–G59), MDI, spindle/coolant, or file loading, and the `ci.yml`
Cypress job runs `npm run preview` against a built `dist/` with **no Moonraker**,
so it passes by asserting a connection-required screen.

The Docker dev harness (`docs/prd/docker-dev-harness.md`, now merged) builds
the current frontend and serves it against a real Moonraker container. Its PRD
**explicitly deferred** wiring it into CI as an e2e job:

> "a follow-up may run the harness for e2e; revisit after the harness has proven
> stable locally."

The harness is now committed and stable — this PRD activates that follow-up.

## 2. Goals

1. Run the Docker harness in CI to exercise the real frontend against a real
   Moonraker container (machine page, WCS preview, jog, MDI).
2. Add unit coverage for the **CNC-critical layer** — the fork's
   differentiator — currently untested: `cncApi`, `cncMetadata`,
   `useCncOffsets`, `useCncProfile`, `mockMoonrakerDb`.

## 3. Non-Goals

- No full-fidelity Klipper in CI (hardware access, out of scope per harness PRD).
- No change to hardware behavior; test-only work.
- No coverage threshold enforcement (a floor is a follow-up).

## 4. Decision

Adopt both tracks — a harness-backed e2e CI job and targeted Vitest coverage —
because they are complementary: e2e proves the integrated path, unit tests make
the CNC logic regression-safe and fast.

## 5. Requirements

### R1 — Harness-backed e2e CI job

Add a job (or replace the current `cypress` job) to `.github/workflows/ci.yml`
that:

- checks out the repo,
- `npm ci`,
- `npm run build`,
- `cd docker && docker compose up -d --wait` (or with a healthcheck wait),
- runs Cypress against `http://localhost:8080`,
- tears down with `docker compose down`.

### R2 — Meaningful e2e assertions

Expand `cypress/e2e/dashboard.cy.ts` (or add specs) to assert behavior beyond
the splash screen against the containerized Moonraker:

- WCS preview / DRO renders machine state,
- jog panel issues commands (observable via Moonraker mock/state),
- MDI console accepts and echoes input,
- file browser lists the containerized Moonraker's `gcodes` directory.

If real Moonraker state is needed that the harness doesn't seed, seed it via
the same `mock-moonraker.cjs` helpers or a small fixture volume.

### R3 — CNC-critical unit coverage

Add Vitest specs (`tests/**/*.spec.ts`) for:

- `src/store/files/cncApi.ts` — spindle/coolant/WCS/bash against the mock,
- `src/store/files/cncMetadata.ts` — `.cnc-meta.json` parsing,
- `src/composables/useCncOffsets.ts` — offset math (G54–G59),
- `src/composables/useCncProfile.ts` — profile load/apply,
- `src/utils/mockMoonrakerDb` — fixture correctness.
  Follow existing `tests/` jsdom setup; assert on store/composable state, not
  DOM where possible.

### R4 — Keep the dev doc honest

Update `docs/prd/docker-dev-harness.md` §3 Non-Goals ("No CI integration in
this PR") to note CI e2e now exists, and note the harness's CI use in
`docker/README.md`.

## 6. Deliverables

| File                             | Change                                             |
| -------------------------------- | -------------------------------------------------- |
| `.github/workflows/ci.yml`       | harness-based e2e job (replaces/extends `cypress`) |
| `cypress/e2e/*.cy.ts`            | expanded behavioral assertions                     |
| `tests/**/*.spec.ts`             | new CNC-critical unit specs                        |
| `docker/README.md`               | note CI usage                                      |
| `docs/prd/docker-dev-harness.md` | update deferred-CI note                            |

## 7. Acceptance Criteria

1. CI e2e job builds the frontend, boots the harness, and Cypress passes
   asserting real interactions (not just the splash).
2. New Vitest specs run green as part of `npm run test:unit`; suite count rises
   meaningfully (target: ≥60 tests across the added specs).
3. `npm run lint` / `npm run typecheck` still pass.
4. Harness still works locally (manual `docker compose up -d` sanity).

## 8. Risks & Mitigations

- **Harness determinism in CI** — container startup/health timing. _Mitigation:_
  `--wait` + healthcheck; seed fixed state.
- **Cypress flake against live Moonraker** — _Mitigation:_ use the determininstic
  harness Moonraker (fixed version `0.11.0`), seed gcodes, allow generous but
  bounded waits.
- **Scope creep** — keep e2e to the listed critical interactions; a full CNc
  automation suite is a separate effort.

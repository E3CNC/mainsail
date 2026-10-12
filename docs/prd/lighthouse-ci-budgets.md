# PRD: Lighthouse CI job with transfer budgets (performance follow-up)

- **Status:** Proposed
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-12
- **Scope:** `.github/workflows/ci.yml`, `lighthouserc` / budgets config, `docs/prd/frontend-performance.md`
- **Parent:** `docs/prd/frontend-performance.md` (Done 2026-10-09) deliberately
  deferred this: "No Lighthouse CI job in this PR (flake-prone on shared
  runners; R6 keeps it a documented local gate — a CI job is a follow-up)."

## 1. Problem

The performance wins (7.9 MB → 2.4 MB, a11y 72 → 92) are locked only by unit
floors and e2e smoke — nothing in CI fails if someone re-adds a 4 MB font
fallback, eagerly imports ECharts in `main.ts`, or ships an unlabeled
icon-only button. The local gate (`npm run perf`, R6) exists but is tribal
knowledge and never runs on push.

A naive "fail if perf score < 70" job cannot work: the parent PRD's own
progress log shows the desktop perf score swinging **25–56 across runs with
box load** (TBT 1795/806/312 ms; loaded-box TBT 8.6 s). Gating on the score
would red-green CI at random.

## 2. Goals

1. Fail CI on the metrics that are **deterministic**: transfer bytes (the
   dist is content-hashed — same bytes every run) and stable Lighthouse
   audits (`link-name`, `button-name`, `label`, `font-display`).
2. Keep the flaky metrics (perf score, FCP/LCP/TBT timings) **informational**:
   recorded as a job artifact, never gating.
3. Reuse the exact R6 reference setup so local and CI measure the same thing.

## 3. Non-Goals

- No gating on performance score or timing metrics (see §1 variance data).
- No Pi-touchscreen / device-lab testing (parent PRD Non-Goals stand).
- No blocking of the release workflow; this gates `push` to `master` like
  the other `ci.yml` jobs.
- No new local tooling — `npm run perf` stays the local equivalent.

## 4. Decision

Adopt a **budgets-not-scores** CI job: `lighthouse-ci` (or `lhci`) against
the mock-backed production build with `assert` on byte budgets and stable
audits only, plus an upload of the full report for the informational timings.
One automatic retry absorbs cold-runner flake (same policy that cleared the
R6 mock-E2E flake: re-ran the failed job, all green).

## 5. Requirements

### R1 — CI job reusing the R6 reference setup

Add a job to `.github/workflows/ci.yml` (same `runs-on: ubuntu-latest` /
node 20 / `npm ci` pattern) that:

- `npm run build`,
- starts `node mock-moonraker.cjs` (serves `dist/` same-origin on
  `127.0.0.1:7125`, deterministic WCS/motion state — same origin the R6
  gate measures),
- provisions headless Chrome (`browser-actions/setup-chrome` or equivalent;
  pass `--no-sandbox --disable-gpu` as in `npm run perf`; needs no
  `CHROME_PATH` once the action is on PATH),
- runs Lighthouse desktop preset against `http://127.0.0.1:7125/`,
- uploads the JSON/HTML report as a job artifact (informational timings
  live here, never gate).

### R2 — Gate on bytes and stable audits only

Assert (fail the job on breach):

- total dashboard-route transfer **< 3 MB** (measured 2.4 MB at parent
  close; catches a re-added font fallback or eager heavy import),
- font transfer on the dashboard route **< 800 KB** (measured ~90 KB —
  catches a TTF regression),
- `echarts-*`, `gcodeviewer`, `codemirror` chunks **absent** from the
  dashboard route's transfer list (R2/R4 invariants),
- accessibility **≥ 90** with zero `link-name` / `button-name` / `label`
  failures (R5 invariant; measured 92),
- best-practices **== 100** (measured 100, fully deterministic).

Explicitly not asserted: performance score, FCP/LCP/TTI/TBT, SEO (91 at
close — one point of headroom is not a gate).

### R3 — Allowed-flake policy

- One automatic retry (`retry` / re-run semantics) before the job counts
  red — shared-runner cold starts are the known flake source (parent R6
  log: mock-E2E failed 10/10 on a cold runner, 16/16 green on rerun).
- If the job flakes more than ~1 in 20 runs over a month, downgrade byte
  budgets to warn-only and record that here rather than deleting the job.

### R4 — Keep local and CI measuring the same thing

- The CI job must encode the same origin, preset, and flags as
  `npm run perf`; any drift (new flags, different preset) updates the
  `perf` script and this PRD together.
- On close, flip the parent PRD's "No Lighthouse CI job" Non-Goal to Done
  with a pointer here.

## 6. Deliverables

| File                               | Change                                            |
| ---------------------------------- | ------------------------------------------------- |
| `.github/workflows/ci.yml`         | new Lighthouse-budgets job (R1)                   |
| `lighthouserc.*` / budgets config  | byte + audit assertions (R2)                      |
| `docs/prd/frontend-performance.md` | flip deferred-CI note to Done (R4)                |
| this PRD                           | Proposed → Done with closing numbers on green run |

## 7. Acceptance Criteria

1. Job is green on a clean checkout at the parent PRD's closing numbers
   (2.4 MB total, a11y 92, BP 100).
2. A synthetic regression (e.g. temporarily restoring one TTF `src` line)
   fails the job on the font budget — proving the gate bites.
3. Perf score / timings appear in the artifact but never fail the build.
4. `npm run lint` (0 errors) / `npm run format:check` / `npm run typecheck`
   / `npm run test:unit` still pass (config-only addition).

## 8. Risks & Mitigations

- **Shared-runner variance leaks into byte counts** (compression, headers)
  — _Mitigation:_ budgets sit ~25% above measured reality (3 MB vs 2.4 MB);
  raw bytes, not timings, vary the least.
- **Chrome provisioning drift** (setup-chrome versions, flags) —
  _Mitigation:_ pin the action version; flags live next to the `perf`
  script definition, updated together per R4.
- **Mock drift** (new seeded content shifts transfer) — _Mitigation:_
  `mockMoonrakerDb` has 100% unit coverage; seeded-file changes update
  budgets in the same change.
- **Threshold gaming** — _Mitigation:_ same stance as the coverage PRDs;
  budgets track measured reality with headroom, ratcheted only with the
  work that earns them.

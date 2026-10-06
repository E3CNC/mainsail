# PRD: Clean up dead PR-only CI workflows; gate direct-to-master with code style

- **Status:** Accepted
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-06
- **Scope:** `.github/workflows/`, `.prettierignore`

## 1. Problem

This fork lands changes **directly on `master` with no PR flow** (documented in
`agent_docs/CONTRIBUTING.md` and `AGENTS.md`). Yet three GitHub Actions
workflows exist purely for pull requests:

- `pr-checks.yml` — triggers on `pull_request` (never fires here), but is the
  **only** place the code-style gate (ESLint + Prettier + typecheck) runs.
- `pr-title.yml` — validates PR titles on `pull_request_target` (dead).
- `pr-comment.yml` — posts comments on PR Checks completion (dead).

Meanwhile `ci.yml` (triggered on push to `master`) only builds, runs vitest,
and runs Cypress — it does **not** enforce code style. So the most important
gate (style/lint) is running on a trigger that never fires for this repo's
direct-to-master workflow.

## 2. Goals

1. Delete the three PR-only workflows — they are dead weight and misleading.
2. Move the code-style gate (lint + prettier + typecheck) into `ci.yml` on
   `push` to `master`, so the real commit path is actually gated.
3. Reconcile local vs. CI style expectations so local `npm run format:check`
   and CI's `prettier --check .` can both pass (see R4).

## 3. Non-Goals

- No change to the release workflow (`e3cnc-release.yml`).
- No introduction of a PR flow.

## 4. Decision

Adopt: delete `pr-checks.yml`, `pr-title.yml`, `pr-comment.yml`; add a
`code-style` job to `ci.yml`; extend `.prettierignore` to cover files Prettier
cannot parse (see R4). This keeps a single style gate that actually runs.

## 5. Requirements

### R1 — Delete PR-only workflows

Remove `.github/workflows/pr-checks.yml`, `.github/workflows/pr-title.yml`,
`.github/workflows/pr-comment.yml`.

### R2 — Gate style on push in ci.yml

Add a `code-style` job to `.github/workflows/ci.yml` (same
`runs-on: ubuntu-latest` / node 20 / `npm ci` pattern) running:

- `npx eslint .` (errors fail the build; `any`-ratchet = warn for legacy list)
- `npx prettier --check .`
- `npm run typecheck`

### R3 — Drop dead template references

Confirm `PULL_REQUEST_TEMPLATE.md` / issue templates are still wanted for the
(future/tooling) PR surface; if they reference `pr-checks` outcomes, adjust text
so they don't promise a job that no longer exists.

### R4 — Reconcile Prettier parse failures

`prettier --check .` fails to parse non-code files (`docker/nginx.conf`,
`docker/Dockerfile`, `.gitignore`, and similar). Add entries to `.prettierignore`
for any path Prettier cannot parse, so both local `npm run format:check` and CI
can pass cleanly on a fresh checkout. Do **not** silence real code files — only
files Prettier structurally cannot format (nginx/docker/ignore config).

## 6. Deliverables

| File                               | Change                               |
| ---------------------------------- | ------------------------------------ |
| `.github/workflows/pr-checks.yml`  | **deleted**                          |
| `.github/workflows/pr-title.yml`   | **deleted**                          |
| `.github/workflows/pr-comment.yml` | **deleted**                          |
| `.github/workflows/ci.yml`         | add `code-style` job                 |
| `.prettierignore`                  | add non-parseable config paths       |
| `.github/PULL_REQUEST_TEMPLATE.md` | adjust if it references removed jobs |

## 7. Acceptance Criteria

1. `git status` shows the three PR workflows deleted.
2. `ci.yml` contains a `code-style` job that runs on push to `master`.
3. On a clean checkout, `npx prettier --check .` and `npm run typecheck`
   pass locally **and** match what CI's new job runs.
4. `npm run lint` reports 0 errors.

## 8. Risks & Mitigations

- **Stepping on style signal** — ignoring too much in Prettier. _Mitigation:_
  only add paths Prettier cannot parse (config/non-code), never real `.ts`/`.vue`.
- **Losing the "PR Checks" comment nicety** for any occasional PR — accepted;
  this fork has no PR workflow by definition.

# PRD: Version ↔ release-tag drift guard

- **Status:** Accepted
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-06
- **Scope:** `.github/workflows/`, release tooling, `docs/`

## 1. Problem

Releases are cut by hand via the "E3CNC Release" workflow
(`.github/workflows/e3cnc-release.yml`), which creates a
`e3cnc-mainsail-vX.Y.Z` tag at whatever commit it runs on. The tag name, the
`package.json` `version`, `RELEASES.md`, and `CHANGELOG.md` are all maintained
manually and can drift apart — and they already did once.

`RELEASES.md` documents the collision:

> "the `e3cnc-mainsail-v0.10.5` tag also sat on a package.json still at 0.10.4."

There is no `develop` branch and no PR gate, so nothing structurally prevents a
tagged release whose package.json version doesn't match the tag.

## 2. Goals

1. Fail a release if `package.json` `version` doesn't equal the `X.Y.Z` in the
   requested `e3cnc-mainsail-vX.Y.Z` tag — at the point where it's cheapest to
   catch (the release workflow itself, and/or a push-time guard).
2. Keep the manual process; just make the invariant checkable and enforced.

## 3. Non-Goals

- No automated version bumping (explicitly rejected in the release workflow's
  own comments — "no semantic-release/version bumping").
- No change to the tag scheme (`e3cnc-mainsail-vX.Y.Z` is settled).

## 4. Decision

Add a **validation step** in the release workflow that parses `inputs.tag`,
reads `package.json` `version`, and fails if they don't match. This is the
single point every release passes through, so it's the highest-leverage guard.

## 5. Requirements

### R1 — Validate tag ↔ version in the release workflow

Add a step to `e3cnc-release.yml`, before build, that:

- extracts `X.Y.Z` from `inputs.tag` (must match `^e3cnc-mainsail-v(\d+\.\d+\.\d+)$`),
- reads `package.json` `version` (via `node -p`),
- fails (`exit 1`) if they differ, printing the mismatch,
- warns if `RELEASES.md` / `CHANGELOG.md` don't have a matching header (soft
  check, non-fatal).

### R2 — Optional push-time guard (cheap belt-and-suspenders)

Add a small `ci.yml` step (or `pre-push` note in docs) on `push` to `master`
that, when the pushed commit bumps `package.json` `version`, requires the
latest `e3cnc-mainsail-v*` tag to match — detect drift before any tag is cut.
If this adds complexity, keep it as a documented manual checklist item instead;
the workflow-level check (R1) is the required one.

### R3 — Document the invariant

Add a "Release checklist" section to `RELEASES.md` stating the invariant:
package.json version must equal the tag's X.Y.Z before dispatching the release
workflow, and that the workflow now enforces it.

## 6. Deliverables

| File                                  | Change                               |
| ------------------------------------- | ------------------------------------ |
| `.github/workflows/e3cnc-release.yml` | add tag↔version validation step      |
| `RELEASES.md`                         | add release-checklist invariant note |

## 7. Acceptance Criteria

1. Dispatching the release workflow with a version-mismatched tag fails fast
   with a clear message, before build.
2. Dispatching with a matching tag proceeds normally.
3. `RELEASES.md` documents the invariant.

## 8. Risks & Mitigations

- **Blocking a legit release** if package.json wasn't bumped — that's the
  point; the fix is to bump `version` in the release commit (already the
  documented process).
- **Over-engineering R2** — keep it optional; R1 is sufficient to prevent the
  historical collision.

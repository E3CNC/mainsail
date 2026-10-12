# E3CNC Mainsail Releases

Hand-maintained release notes for the E3CNC fork. Upstream's CI-generated
`release.yml` (and its automatic CHANGELOG.md regeneration) was removed from
the fork; this file and CHANGELOG.md are now maintained by hand per release.

## Versioning scheme

- Release tags: `e3cnc-mainsail-vX.Y.Z` (namespaced, distinct from upstream `v*` tags).
- `package.json` `version` is the source of truth and must equal `X.Y.Z` of the tag.
- `tag_pattern` in cliff.toml matches the scheme (kept for `git-cliff` runs at
  release-prep time; manual: `git-cliff --config cliff.toml
upstream-freeze-2026-06-05..HEAD`).
- Releases are cut via the "E3CNC Release" workflow (`.github/workflows/e3cnc-release.yml`).

### Historical note

Before this scheme was unified, two collided: the Vue 3 frontend swap
(`c35a95b9`) carried a package.json already at 0.10.x while early fork tags used
`e3cnc-v0.1.0` / `e3cnc-mainsail-v0.2.0/0.3.0`. The `e3cnc-mainsail-v0.10.5`
tag also sat on a package.json still at 0.10.4. These tags are left as-is;
from v0.10.6 on, tag and manifest match.

### Release checklist (invariant, enforced)

Before dispatching the "E3CNC Release" workflow, confirm:

1. `package.json` `version` equals the `X.Y.Z` in the tag you're cutting
   (`e3cnc-mainsail-vX.Y.Z`). The release workflow now **fails fast** — before
   build — if the tag's version doesn't match `package.json`.
2. Bump `package.json` `version` to `X.Y.Z` in the release commit itself if it
   isn't already there.
3. `RELEASES.md` and/or `CHANGELOG.md` have a `## [e3cnc-mainsail-vX.Y.Z]`
   header with that release's notes (the workflow warns, non-fatally, if not).

See `docs/prd/release-version-drift-guard.md` for the guard's full spec.

## [e3cnc-mainsail-v0.10.8] - 2026-10-12

### Performance (Lighthouse desktop, mock-backed prod build)

- First-load transfer 7.9 MB -> 2.4 MB; accessibility 72 -> 92; SEO 82 -> 91
- Fonts subsetted to woff2 (latin + symbols via `unicode-range`), Ndot 57
  self-hosted, TTF fallbacks dropped (`7eba7942`, `b658deea`)
- ECharts lazy-loaded off the critical path; Vuetify JS treeshaken;
  non-dashboard routes code-split (`90e3e004`, `d5c0a75e`, `0f484608`)
- Icon-only controls labeled; a11y eslint guard; `npm run perf` local gate
  (`9950c7ad`, `def2688a`)

### Bug Fixes

- History list `.gcode` filter no longer drops maintenance rows; HistoryEntry
  status color; JobqueueEntry kg-weight crash; WCS manual offsets now apply
  (`b776eadf`)
- MDI e2e input scoped to the visible console textarea (`8b5d4db7`)

### Testing & CI

- Unit suite 317 -> 1562 tests across 149 files; global lines 15% -> 75%;
  coverage backstop ratcheted to 70 (`0e83221e`)
- Mock-backed CNC e2e (jog/MDI/WCS/files) plus per-page smoke pass; Docker
  harness e2e; vitest job gates on coverage (`867984e8`, `24b7851e`)
- Code-style gate (lint + prettier + typecheck) moved onto push to master;
  dead PR-only workflows removed (`72bcf249`)
- Release tag<->version drift guard in the release workflow (`72bcf249`)

### Tooling & Docs

- Committed Docker dev harness (Moonraker 0.11.0 pinned); fixed package.json
  repo/bugs/homepage URLs (`b44f4596`, `3d22e61c`)
- Deleted dead PageNotFound.vue (`a6bfc5b9`)
- Closed frontend-performance + full-coverage-closure PRDs; proposed
  Lighthouse CI budgets follow-up (`f7ea02c2`)

## [e3cnc-mainsail-v0.10.7] - 2026-10-01

### Bug Fixes

- **console**: Sanitize console messages with DOMPurify (90a77686) — XSS hardening, upstream port
- **store**: Guard configfile access when not yet loaded (22c72f1c)
- **timelapse**: generateTimestamp for selected-files zip name (e88fdcf6); clear file selection on folder switch (27b22d81)
- **webcam**: Resolve relative go2rtc stream URLs to the websocket API (fcf8b126)
- **macros**: Expert mode stays usable after clear; drag sorting fixed (da705ada)
- **StartPrintDialog**: Pull gcode metadata for thumbnails on open (79e318ac)

### Tooling & Docs

- ESLint error backlog eliminated; code-style CI gate reinstated with the `no-explicit-any` ratchet (a39efe0a)
- Ratchet list shrunk 89 -> 7 files, 346 `any` sites re-typed (96be0a80)
- Dead CI pipelines removed; workflows retargeted to master (b11d4f54, c9cb8682)
- Release tag scheme unified on e3cnc-mainsail-vX.Y.Z (41c7e7a8)
- Docs aligned with fork reality; root CONTRIBUTING.md dropped for the direct-push workflow (6599395b)

## [e3cnc-mainsail-v0.10.6] - 2026-09-25

### Bug Fixes

- **config**: Default hostname/port to null so remote browsers connect to the host they're served from (946b3aa8)

## [e3cnc-mainsail-v0.10.5] - 2026-09-20

### Bug Fixes

- **release**: Set `project_owner` to E3CNC so Moonraker's update manager polls the correct repo (46a49e4d)

## [e3cnc-mainsail-v0.3.0] - 2026-09-17

### Features

- **Farm**: Empty state shown when no machines are registered, centered in the panel (dfb46f4c, e2dbac1d)

### Bug Fixes

- **i18n**: Rephrased Z-offset post-job hint for CNC focus (10f63fb5)

### Testing & Config

- Unit tests for mock moonraker DB (13 tests) and FarmPrinterPanel (4 tests) (56aa59ff)
- ESLint switched to Vue 3 recommended rules (de2398b3)

## [e3cnc-mainsail-v0.2.0] - 2026-09-17

### Features

- **Mock Moonraker**: Stateful CNC WCS with 6 offset profiles, toolhead tracking, work coordinate calculation (0b81d999)
- **Mock Moonraker**: Toolhead motion simulation on `printer.gcode.script` (G0/G1/G28/G90/G91 parsing) (004bd1bf)

### Fixes & Build

- Docs now describe the E3CNC Vue 3 fork accurately (68c9096e)
- Legacy peer deps set for Vite 7 / plugin-vue peer conflict (aba8d391)
- Build zips `dist` into `mainsail.zip` (36210aa9)

## [e3cnc-v0.1.0] - 2026-06-10

- E3CNC Release workflow added: CI-built `mainsail.zip` attached to GitHub Releases, the artifact the e3cnc-installer downloads (ADR-0001) (28eff4f0)

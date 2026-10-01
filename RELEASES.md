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

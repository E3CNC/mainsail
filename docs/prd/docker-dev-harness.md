# PRD: Committed Docker Dev Harness for E3CNC Mainsail

- **Status:** Accepted
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-06
- **Scope:** `docker/`, root `docker-compose.yml`, `.gitignore`, `docs/`

## Decisions (2026-10-06)

1. **Location:** harness stays at `docker/` (no move to `dev/docker/`).
2. **Moonraker:** pin to **`0.11.0`** (latest stable on PyPI at time of writing).
3. **CI:** **local-only** for now; a CI e2e job is a follow-up, out of scope here.

## 1. Problem

An untracked, local-only Docker stack exists in the working tree:

- **Root `docker-compose.yml`** — pulls `ctf133/moonraker:latest` and mounts a
  **root `moonraker.conf` that does not exist**. Broken as written.
- **`docker/` stack** — builds Moonraker from source (`python:3.11-slim`,
  `pip install moonraker`), runs `nginx:alpine` serving a **prebuilt
  `docker/mainsail/` tree** plus a 7 MB `docker/mainsail.zip`, with SPA routing
  and a `/websocket` proxy.
- **`docker/nginx.conf`** is non-portable: hardcoded macOS paths
  (`/Users/isaaceliape/repos/mainsail/docker/mainsail`,
  `/opt/homebrew/etc/nginx/mime.types`), top-level `http`/`events` blocks that
  are invalid under the `nginx:alpine` `conf.d` include model, and `localhost`
  upstreams that do not resolve inside the Docker network.
- Committed build output (a full `mainsail/` asset tree + `mainsail.zip`) in a
  source repo.

The stack is a genuine **local dev/e2e harness** (README: "Klipper cannot run
in Docker on macOS"), but it is unversioned, non-portable, and mixes source
with build artifacts.

Separately, the **release path is already settled**: `e3cnc-release.yml`
builds `dist/mainsail.zip` in CI and attaches it to a GitHub Release
(ADR-0001: Mainsail is never built on the target). Upstream's Docker publishing
workflows were intentionally removed from the fork.

## 2. Goals

1. Turn `docker/` into a **committed, portable, reproducible dev harness** that
   builds the current frontend and serves it against a real Moonraker container.
2. Keep **build artifacts out of git**.
3. Eliminate the broken root `docker-compose.yml`.
4. Make `.gitignore` and docs consistent with the above.

## 3. Non-Goals

- **No container distribution / publish pipeline.** This is a dev harness, not
  a release artifact. ADR-0001 stands; `e3cnc-release.yml` remains the only
  distribution path.
- **No Klipper in Docker.** Hardware access is out of scope (documented).
- **CI integration deferred in this PR** (a follow-up was contemplated to run the
  harness for e2e). **Done:** the harness now backs the **E2E (Docker harness)**
  job in `.github/workflows/ci.yml` — see `docs/prd/ci-e2e-and-cnc-coverage.md`.

## 4. Decision

Adopt **option (a): committed dev harness**, with the frontend **built and
mounted from `dist/`**. Option (b) — deleting the stack — is rejected because
the harness has real value for testing the fork without hardware.

## 5. Requirements

### R1 — Remove the broken root compose

Delete the root `docker-compose.yml` (no matching root `moonraker.conf`).

### R2 — Portable nginx config

Rewrite `docker/nginx.conf` so it works as an `nginx:alpine` `conf.d` server
block:

- Drop top-level `http`/`events` blocks and `daemon off`.
- Serve `root /usr/share/nginx/html` (mounted `dist/`), not a host path.
- Proxy `/websocket` and API prefixes to the **service name** `moonraker:7125`,
  not `localhost`.
- Remove the macOS MIME include.

### R3 — Build-and-mount the frontend

- Delete committed `docker/mainsail/` and `docker/mainsail.zip`.
- nginx mounts the repo-local `dist/` (produced by `npm run build`).
- `docker/README.md` documents the two-step flow:
  `npm run build` → `docker compose up -d`.

### R4 — Reproducible Moonraker image

Keep the from-source `docker/Dockerfile`, but pin the Moonraker version
(`pip install moonraker==0.11.0`) instead of floating `latest`/unpinned, so
the harness is reproducible. Document the bump procedure in `docker/README.md`.

### R5 — Ignore hygiene

Add to `.gitignore`: `.playwright-mcp/`, and any harness-produced artifacts not
already covered (`docker/mainsail/`, `docker/mainsail.zip`, `docker/.env*`).

### R6 — Docs

Update `docker/README.md` to be accurate for the new flow (build frontend
first, service-name networking, port 8080). Add a one-line pointer from
`AGENTS.md`'s commands section only if the harness becomes a supported
workflow.

## 6. Deliverables

| File                                      | Change                                    |
| ----------------------------------------- | ----------------------------------------- |
| `docker-compose.yml` (root)               | **deleted**                               |
| `docker/nginx.conf`                       | rewritten, portable                       |
| `docker/docker-compose.yml`               | mounts `../dist`, service-name upstream   |
| `docker/Dockerfile`                       | Moonraker pinned to `0.11.0`              |
| `docker/README.md`                        | rewritten                                 |
| `docker/mainsail/`, `docker/mainsail.zip` | **removed from tree**                     |
| `.gitignore`                              | add `.playwright-mcp/`, harness artifacts |

## 7. Acceptance Criteria

1. `npm run build` then `docker compose up -d` (in `docker/`) serves the
   current frontend at `http://localhost:8080` talking to the containerized
   Moonraker at `:7125`.
2. No hardcoded host paths or usernames anywhere in `docker/`.
3. `git status` shows no build artifacts under `docker/`.
4. Full gate passes: `npm run lint` (0 errors), `npm run format:check`,
   `npm run typecheck`, `npm run test:unit` (44/44).
5. Verified on a **clean checkout** (cloned fresh, no local build present).

## 8. Risks & Mitigations

- **Harness rot** — a dev harness not exercised in CI drifts. _Mitigation:_
  note it as a candidate for a future e2e CI job; keep it small.
- **Moonraker version pin churn** — pin will age. _Mitigation:_ document bump
  procedure in `docker/README.md`.
- **Scope creep into distribution** — resist adding a Docker release path;
  that contradicts ADR-0001.

## 9. Open Questions

_None outstanding — see Decisions above._

Deferred (not in scope): whether to add a CI e2e job that exercises the
harness; revisit after the harness has proven stable locally.

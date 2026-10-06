# Docker Dev Harness for E3CNC Mainsail

A local development/test harness that builds the current Mainsail frontend and
serves it against a real Moonraker container. It is **not** a release or
distribution path — see ADR-0001; `e3cnc-release.yml` remains the only
pipeline that produces `dist/mainsail.zip` for GitHub Releases.

> **Klipper cannot run in Docker.** Klipper needs direct hardware access
> (serial/USB) and does not run in Docker on macOS. This harness is for
> developing and testing the frontend + Moonraker integration without
> hardware; Klipper must run on a Linux host (e.g. a Raspberry Pi) or the host
> directly.

## Flow

The harness serves the **built frontend from `dist/`** (produced by
`npm run build`) — it does not commit build artifacts. A two-step flow:

1. Build the frontend:
   ```bash
   npm run build
   ```
2. Start the stack from `docker/`:
   ```bash
   cd docker
   docker compose up -d
   ```

Moonraker is built from source (`docker/Dockerfile`, `python:3.11-slim`,
`pip install moonraker==0.11.0`) and talks to the nginx container over the
compose network by **service name** (`moonraker:7125`), not `localhost`.

Access Mainsail at **http://localhost:8080**.

## Prerequisites

- Docker and Docker Compose
- Node.js (for `npm run build`)

## Commands

| Command                             | Action                                                |
| ----------------------------------- | ----------------------------------------------------- |
| `npm run build`                     | Build the frontend into `dist/` (run before starting) |
| `cd docker && docker compose up -d` | Start the stack                                       |
| `docker compose ps`                 | Check status                                          |
| `docker compose logs -f moonraker`  | Follow Moonraker logs                                 |
| `docker compose down`               | Stop and remove containers                            |

## Connecting the Mainsail Dev Server (optional)

For hot-reload development (instead of the built `dist/`), point the dev
server at the containerized Moonraker. Update `.env.development.local`:

```
VUE_APP_HOSTNAME=localhost
VUE_APP_PORT=7125
```

Or update `public/config.json`:

```json
{
  "hostname": "localhost",
  "port": 7125
}
```

Then `npm run serve` and open http://localhost:8080/.

## Port Mapping

| Container Port | Host Port | Service             |
| -------------- | --------- | ------------------- |
| 7125           | 7125      | Moonraker API       |
| 7126           | 7126      | Moonraker WebSocket |
| 80             | 8080      | Mainsail (nginx)    |

## Data Persistence

Moonraker data lives in the `moonraker_data` Docker volume at `/data`:

- `/data/config/` — Configuration files
- `/data/database/` — SQLite database
- `/data/gcodes/` — G-code files
- `/data/logs/` — Log files
- `/data/printer_data/config/` — Printer configuration

## Bumping the Moonraker Version

The harness pins Moonraker to `0.11.0` in `docker/Dockerfile` so builds stay
reproducible. To bump:

1. Check the latest stable release on PyPI: `pip index versions moonraker`.
2. Update `moonraker==<version>` in `docker/Dockerfile`.
3. Rebuild and verify: `cd docker && docker compose build moonraker && docker compose up -d`.
4. Commit the change (the pin is reviewed and versioned like any dependency).

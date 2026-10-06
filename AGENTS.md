# Mainsail (E3CNC fork) AI Guidelines

Mainsail is a Vue 3.5 + TypeScript web interface for Klipper-based CNC machines, using Vuetify 3, Vuex 4, vue-router 4, and Vite 7.

> **CRITICAL:** Use Vue 3 `<script setup>` with the Composition API and composables from `src/composables/`.
> Do NOT use Vue Class Components, decorators, or mixins.

## Commands

- `npm run mock` - Fake Moonraker on 127.0.0.1:7125 (WebSocket + HTTP + `/server/cnc/*`)
- `npm run serve` - Dev server (port 8080; point it at the mock via `.env.development.local`)
- `npm run build` - Production build (produces `dist/mainsail.zip`)
- Docker dev harness - `npm run build` then `cd docker && docker compose up -d` to serve the frontend against a containerized Moonraker (see [docker/README.md](docker/README.md))
- `npm run lint` / `npm run lint:fix` - ESLint on `src`
- `npm run format` / `npm run format:check` - Prettier (repo-wide `--check` has pre-existing failures; verify only the files you touch)
- `npm run typecheck` - vue-tsc
- `npm run test:unit` - Unit tests (Vitest, `tests/**/*.spec.ts`)
- `npm run test:ui` - E2E tests (Cypress)

## Git Workflow

Push directly to `master` (the fork's active and default branch — there is
no `develop` branch and no PR flow; there is no CONTRIBUTING.md). Upstream
mainsail-crew/mainsail is Vue 2.7: do NOT merge or cherry-pick it;
re-implement upstream fixes in Composition API style. Commits need DCO
sign-off (`git commit -s`) and Conventional Commits titles. Before pushing,
run the full gate locally: `npm run lint` (0 errors), `npm run format:check`,
`npm run typecheck`, `npm run test:unit`.

## Guidelines

| Topic                             | File                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| Project structure & store modules | [agent_docs/ARCHITECTURE.md](agent_docs/ARCHITECTURE.md)     |
| Vue 3 setup & TypeScript          | [agent_docs/VUE_TYPESCRIPT.md](agent_docs/VUE_TYPESCRIPT.md) |
| Formatting, naming, patterns      | [agent_docs/CODE_STYLE.md](agent_docs/CODE_STYLE.md)         |
| Vuetify, icons, i18n              | [agent_docs/UI_I18N.md](agent_docs/UI_I18N.md)               |
| Code review checklist             | [agent_docs/CODE_REVIEW.md](agent_docs/CODE_REVIEW.md)       |
| Git workflow & agent conventions  | [agent_docs/CONTRIBUTING.md](agent_docs/CONTRIBUTING.md)     |

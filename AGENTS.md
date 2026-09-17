# Mainsail (E3CNC fork) AI Guidelines

Mainsail is a Vue 3.5 + TypeScript web interface for Klipper-based CNC machines, using Vuetify 3, Vuex 4, vue-router 4, and Vite 7.

> **CRITICAL:** Use Vue 3 `<script setup>` with the Composition API and composables from `src/composables/`.
> Do NOT use Vue Class Components, decorators, or mixins.

## Commands

- `npm run serve` - Dev server (port 8080)
- `npm run build` - Production build
- `npm run lint:fix` - Fix linting
- `npm run format` - Format code
- `npm run test:unit` - Unit tests (Vitest)
- `npm run test:ui` - E2E tests (Cypress)

## Guidelines

| Topic                             | File                                                         |
| --------------------------------- | ------------------------------------------------------------ |
| Project structure & store modules | [agent_docs/ARCHITECTURE.md](agent_docs/ARCHITECTURE.md)     |
| Vue 3 setup & TypeScript          | [agent_docs/VUE_TYPESCRIPT.md](agent_docs/VUE_TYPESCRIPT.md) |
| Formatting, naming, patterns      | [agent_docs/CODE_STYLE.md](agent_docs/CODE_STYLE.md)         |
| Vuetify, icons, i18n              | [agent_docs/UI_I18N.md](agent_docs/UI_I18N.md)               |
| Code review checklist             | [agent_docs/CODE_REVIEW.md](agent_docs/CODE_REVIEW.md)       |
| Git workflow & PRs                | [agent_docs/CONTRIBUTING.md](agent_docs/CONTRIBUTING.md)     |

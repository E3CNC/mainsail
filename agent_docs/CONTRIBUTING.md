# Contributing

## Git Workflow

Submit PRs against the `master` branch — the fork's active and default
branch. There is no `develop` branch (the stale pre-Vue-3 remnant from
upstream was deleted in 2026-09).

PR titles are validated by CI and must follow Conventional Commits.

Sign off commits with DCO (`git commit -s`):

```
Signed-off-by: Your Name <your.email@example.com>
```

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

Format: `type(scope): message`

Scope is optional but recommended for clarity (e.g., `fix(webcam): ...`, `feat(console): ...`).

Types:

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `style` - Formatting changes
- `test` - Adding tests
- `chore` - Maintenance

## Upstream Policy

This fork is Vue 3 + Vuetify 3; upstream mainsail-crew/mainsail is still
Vue 2.7. Never merge or cherry-pick upstream branches (73+ conflicting
files at last measurement). Adopt upstream fixes individually: read the
upstream PR diff (`gh pr diff N --repo mainsail-crew/mainsail`), verify the
bug still applies to this fork's rewritten components, then re-implement it
in `<script setup>` Composition API style.

## Before Submitting

```bash
npm run format        # prettier (check with `npm run format:check`)
npm run lint          # eslint src
npm run typecheck     # vue-tsc
npm run test:unit     # vitest
```

Note: repo-wide style CI (`eslint --max-warnings 0 .`) currently fails on
`master` due to a pre-existing lint backlog; ensure you introduce **no new**
findings in the files you touch (compare against `master` for those files).
Add Vitest regression tests for new/changed behavior (`tests/**/*.spec.ts`,
jsdom; `mock-moonraker.cjs` backs `/server/cnc/*`).

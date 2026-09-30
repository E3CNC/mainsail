# Contributing

## Git Workflow

Push directly to `master` — the fork's active and default branch. There is
no `develop` branch (the stale pre-Vue-3 remnant from upstream was deleted
in 2026-09) and no PR review flow.

Use a local feature branch only when a change needs room to stack or be
dropped before landing; fast-forward it into `master` when done
(`git push origin <branch>:master`), then delete the branch.

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

## Before Pushing

```bash
npm run format        # prettier (check with `npm run format:check`)
npm run lint          # eslint src
npm run typecheck     # vue-tsc
npm run test:unit     # vitest
```

Note: CI enforces style (`eslint .`, `prettier --check .`, `npm run typecheck`)
on every push to `master`.
`no-explicit-any` is a ratchet — `error` by default, 7 legacy store files
grandfathered to `warn` in `eslint.config.mjs` (farm/printer +
printer/tempHistory). Never add a file to that list; removing one is a
contribution. In new code prefer payload interfaces or
`unknown` + narrowing over `any`.
Add Vitest regression tests for new/changed behavior (`tests/**/*.spec.ts`,
jsdom; `mock-moonraker.cjs` backs `/server/cnc/*`).

# PRD: Fix package.json repo metadata (wrong repo links)

- **Status:** Accepted
- **Author:** Isaac Eliape (assisted)
- **Date:** 2026-10-06
- **Scope:** `package.json`

## 1. Problem

The `package.json` repository metadata points at a repo that does not exist:

```json
"repository": { "type": "git", "url": "git+https://github.com/E3CNC/E3CNC.git" },
"bugs": { "url": "https://github.com/E3CNC/E3CNC/issues" },
"homepage": "https://github.com/E3CNC/E3CNC"
```

The actual fork lives at **`E3CNC/mainsail`** (verified: `git remote -v` →
`https://github.com/E3CNC/mainsail.git`). The `E3CNC/E3CNC` URL 404s. This
breaks:

- npm registry metadata (repository / homepage / bugs surfaced by `npm view`),
- GitHub release-to-repo linkage for any tooling that reads `homepage`,
- the bug-report redirect users see when filing issues from npm metadata.

## 2. Goals

1. Point all three fields at the real repository `E3CNC/mainsail`.
2. No behavioral or code changes; a config-only correction.

## 3. Non-Goals

- No URL normalization beyond the three fields (the `name` stays `E3CNC`).

## 4. Decision

Adopt the one-line-fix approach: replace the wrong URLs with the canonical
`E3CNC/mainsail` equivalents. No repo rename, no link redirect service.

## 5. Requirements

### R1 — Correct the fields

In `package.json`:

- `repository.url` → `git+https://github.com/E3CNC/mainsail.git`
- `bugs.url` → `https://github.com/E3CNC/mainsail/issues`
- `homepage` → `https://github.com/E3CNC/mainsail`

## 6. Deliverables

| File           | Change                     |
| -------------- | -------------------------- |
| `package.json` | three URL fields corrected |

## 7. Acceptance Criteria

1. `npm view` on a packed metadata run shows `E3CNC/mainsail` for repository,
   bugs, and homepage.
2. `npm run lint`, `npm run typecheck`, `npm run test:unit` still pass
   (config-only change; sanity check that nothing parses `homepage`).
3. `npm run build` unaffected.

## 8. Risks & Mitigations

- **Low —** metadata-only change; no runtime code path reads these fields.
  _Mitigation:_ trivial diff, easily reverted if any tooling expects the old
  value (unlikely; the old value 404s).

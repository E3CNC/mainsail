# Contributing to Mainsail (E3CNC fork)

Thanks for your interest in improving the E3CNC web UI! This fork is maintained
independently from [mainsail-crew/mainsail](https://github.com/mainsail-crew/mainsail)
(see [agent_docs/ARCHITECTURE.md](agent_docs/ARCHITECTURE.md) for how it differs).
Before submitting a contribution, make sure you've read:

- [Code of Conduct](.github/CODE_OF_CONDUCT.md)
- [Issues and Bugs](#issue)
- [Feature Requests](#feature)
- [Submission Guidelines](#submit)
- [AI-agent conventions](#agents)

## <a name="question"></a> Got a Question or Problem?

For support questions about the E3CNC machine itself, use your usual E3CNC
support channels. For issues with this UI, use the
[issue tracker](https://github.com/E3CNC/mainsail/issues) or
[GitHub Discussions](https://github.com/E3CNC/mainsail/discussions).

## <a name="issue"></a> Found a Bug?

If you find a bug in this fork, you can help by
[submitting an issue](https://github.com/E3CNC/mainsail/issues/new?template=bug_report.yml).
If you have already fixed it, open a [pull request](#submit-pr) with the fix.

Search the tracker first — if a ticket already covers your case, comment there
instead of opening a new one. Include reproduction steps; without them we may
not be able to fix the bug.

## <a name="feature"></a> Missing a Feature?

Request it via a [feature request](https://github.com/E3CNC/mainsail/issues/new?template=feature_request.yml).
For large changes, open an issue to discuss scope before writing code.

Note: this fork targets CNC machines. Upstream 3D-printer features (MMU,
HappyHare, AFC, Spoolman) are not tracked here; the fork removes or rewrites
them as needed.

## <a name="submit"></a> Submission Guidelines

### <a name="submit-pr"></a> Submitting a Pull Request

1. Search existing [pull requests](https://github.com/E3CNC/mainsail/pulls) to
   avoid duplicated work.
2. **Submit PRs against `master`** — the fork's active branch. `develop` is a
   stale pre-Vue-3 remnant from upstream and is not the base for new work.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for commit
   and PR titles (`fix(scope): ...`, `feat(scope): ...`). PR titles are
   validated by CI (`locale`, `docs`, `chore`, `build`, `ci`, `revert` also
   allowed).
4. Sign off every commit with the
   [DCO](.github/DEVELOPER_CERTIFICATE_OF_ORIGIN.md):

   ```
   Signed-off-by: Your Name <your@email.example>
   ```

   (Use `git commit -s`.)

5. Link related issues in the PR body (`Fixes #123`).
6. Before requesting review, run:

   ```bash
   npm run format:check   # or: npm run format
   npm run lint
   npm run typecheck
   npm run test:unit
   ```

   New behavior should come with a Vitest regression test where practical
   (jsdom, `tests/**/*.spec.ts`; the mock Moonraker in
   [`mock-moonraker.cjs`](mock-moonraker.cjs) covers `/server/cnc/*` too).
   E2E tests run via `npm run test:ui` (Cypress).

7. UI changes: screenshots of before/after are welcome.

> ⚠️ The repo-wide `eslint --max-warnings 0 .` and `prettier --check .` jobs in
> the "Code style check" CI workflow currently fail on `master` itself (a
> pre-existing lint backlog inherited from upstream). What CI must not see is
> **new** findings: check the files you touched (`npx eslint <files>`,
> `npx prettier --check <files>`) and compare against their state on `master`.

### Code standards

See [agent_docs/CODE_STYLE.md](agent_docs/CODE_STYLE.md) and
[agent_docs/VUE_TYPESCRIPT.md](agent_docs/VUE_TYPESCRIPT.md). The short version:
Vue 3 `<script setup>` + Composition API only — no class components,
decorators, or mixins; shared logic lives in `src/composables/`.

## <a name="agents"></a> AI Agents

Contributions made (partly) by AI agents must follow
[AGENTS.md](AGENTS.md) and the [agent_docs/](agent_docs/) guidelines. Humans
opening PRs authored by agents remain responsible for DCO sign-off.

## Upstream

This fork builds on [mainsail-crew/mainsail](https://github.com/mainsail-crew/mainsail)
(Vue 2.7). Upstream fixes are adopted selectively and re-implemented in Vue 3 —
a bulk merge is not viable (framework-level divergence). Release notes ship with
each [release](https://github.com/E3CNC/mainsail/releases) (tags
`e3cnc-mainsail-vX.Y.Z`).

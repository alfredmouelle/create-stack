<!-- Title must follow Conventional Commits, e.g. feat(mailer): add Postmark adapter -->

## What & why

<!-- What does this change and what problem does it solve? Link the issue it addresses. -->

Closes #

## Checklist

- [ ] For an opinion-based change, an issue was opened and approved first
- [ ] `pnpm typecheck`, `pnpm check` and `pnpm test` pass
- [ ] Manually tested (for CLI changes: scaffolded a project end to end)
- [ ] Ports stay framework-agnostic; new providers are added as adapters, not by editing the port

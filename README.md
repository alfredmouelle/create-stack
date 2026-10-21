# create-stack

> create-stack assembles a SaaS project for Next.js, TanStack Start or RasenganJS
> preview from a tested reference application, then makes the first commit only
> after install, format, typecheck and lint pass.

[![npm](https://img.shields.io/npm/v/@alfredmouelle/create-stack?color=cb3837&logo=npm&label=create-stack)](https://www.npmjs.com/package/@alfredmouelle/create-stack)
[![license](https://img.shields.io/npm/l/@alfredmouelle/create-stack?color=blue)](./LICENSE)
[![node](https://img.shields.io/node/v/@alfredmouelle/create-stack?color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

```bash
pnpm dlx @alfredmouelle/create-stack@latest my-app
```

Flags, `create-stack add` and the stack builder are on the
[website](https://create-stack.alfredmouelle.com/docs).

## This repository

This pnpm and Turborepo monorepo develops the CLI and everything it copies.

| Path | What lives here |
|---|---|
| `cli/` | The published `@alfredmouelle/create-stack` CLI |
| `apps/*-base/` | Reference applications, one per framework, containing every stack part it supports |
| `packages/<capability>/` | Capabilities, each with a `capability.json` manifest and tests |
| `skills/` | [Agent skills](./skills/README.md): `/create-stack` and `/add-capability` |
| `marketing/` | The website |

Replaceable integrations (mailer, storage, cache, logger, analytics) are **ports**:
application code depends on the port, and the composition root selects the adapter.
Integrations with one useful provider (Inngest jobs, Sentry error tracking) are
**modules**, used directly with their framework wiring.

## Development

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm check
```

Read the [Contributing Guidelines](./CONTRIBUTING.md) before opening an issue or PR,
and [Adding a framework](./docs/adding-a-framework.md) to add one.

## Credits

Inspired by [create-t3-app](https://create.t3.gg) and the work of
[Theo Browne](https://github.com/t3dotgg). Not affiliated with or endorsed by
the T3 project.

## License

[MIT](./LICENSE) © [Alfred MOUELLE](https://alfredmouelle.com)

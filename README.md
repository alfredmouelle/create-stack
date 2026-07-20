# create-stack

> An opinionated, framework-agnostic SaaS foundation. Swappable capabilities
> behind tiny **ports & adapters**, single-provider **modules** for the rest,
> ready to drop into any new project.

[![npm](https://img.shields.io/npm/v/@alfredmouelle/create-stack?color=cb3837&logo=npm&label=create-stack)](https://www.npmjs.com/package/@alfredmouelle/create-stack)
[![license](https://img.shields.io/npm/l/@alfredmouelle/create-stack?color=blue)](./LICENSE)
[![node](https://img.shields.io/node/v/@alfredmouelle/create-stack?color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

A pnpm + turbo monorepo where the external tools worth swapping (email, storage,
cache, logging, analytics) live behind a tiny **port**. App code depends only on
the port, never on a provider, so swapping Resend for Brevo, or S3 for R2, is one
line in a composition root, not a refactor. The tools that are not worth swapping
(jobs on Inngest, error tracking on Sentry) are vendored as **modules** and used
directly, wiring included.

> **Two package names, one project.** `@alfredmouelle/create-stack` is the
> published CLI you install to scaffold a project. `@alfredmouelle/stack` is this
> repo: the private (unpublished) monorepo that develops and ships that CLI.

## Quickstart

Scaffold a new project (framework + foundations + mailer, deps installed, git
initialized):

```bash
pnpm create @alfredmouelle/stack@latest my-app
# equivalent, explicit form (npm / yarn create also work):
pnpm dlx @alfredmouelle/create-stack@latest my-app
```

You pick the framework, monorepo orchestrator, package manager, import alias and
foundations interactively; the CLI forks the matching base app and wires them in.

## Why

Every new SaaS started the same way: clean the boilerplate, set up the linter,
re-install the same libs, re-wire the same integrations. This repo captures those
patterns once. It is opinionated by design (these are the defaults I ship with),
but the agnostic part means a tool is never welded to the codebase: it sits
behind an adapter and can be replaced wholesale. Fork it, or bend the defaults to
your own taste.

## Capabilities

Each `packages/<capability>/` is a self-contained capability with a
`capability.json` manifest and tests. The `kind` field in that manifest is the
source of truth: a **port** has several adapters and is swappable at the
composition root, a **module** has one provider (or none) and is used directly.

### Ports (swappable)

`src/port.ts` holds the interface, `src/adapters/<name>.ts` one adapter per
provider.

| Capability | Port | Adapters |
|---|---|---|
| **mailer** _reference_ | `send()`: body is always a React Email component, rendered to HTML + text | Resend · Brevo · SES |
| **storage** | `put` / `get` / `delete` / `exists` / `getSignedUrl` | S3 · Cloudflare R2 · GCS · local |
| **cache** | `get` / `set` / `has` / `delete` / `wrap` | Redis · Upstash · in-memory |
| **logger** | `trace`…`error` / `child` | pino · console |
| **analytics** | `capture` / `identify` / `flush` | PostHog · Plausible · noop |

### Modules (used directly)

| Capability | What it is | Provider |
|---|---|---|
| **jobs** | the Inngest client plus the serve wiring: durable steps, cron, concurrency, fan-out and typed events stay reachable | Inngest |
| **error-tracking** | shared `Sentry.init` options plus the per-framework files (`onRequestError`, instrumentation, `global-error`); the steps that edit files you own are printed, not applied | Sentry |
| **email-kit** | composable React Email primitives + **swappable theme** + local preview (`email dev`) | n/a |
| **http** | `apiFetch` (typed fetch) + Web-standard `WebhookHandler` | n/a _(for APIs without an SDK)_ |

Design rules:

- **Pure core.** `packages/*` have zero framework code, except where the
  framework integration *is* the product (the error-tracking wiring).
- **Official SDKs** are always preferred over hand-rolled fetch (except `http`,
  whose whole job is fetch).
- **Provider selection by env var**, static imports. (Switch to lazy import +
  per-adapter subexports only if a target deploys to the edge.)
- **Don't abstract what you won't swap.** No port for a single obvious
  implementation, and none either when the port would have to hide what makes the
  provider worth using: the jobs port modelled neither durable steps, nor cron,
  nor concurrency, nor fan-out, so real code reached past it immediately; and
  Sentry's value (Server Component errors via `onRequestError`, source maps,
  preloaded OTel instrumentation, per-request scope isolation) is structurally
  out of reach of a `captureException` wrapper.

## Structure

```
packages/
  mailer/  email-kit/  storage/  jobs/
  cache/  logger/  analytics/  error-tracking/  http/
apps/
  next-base/        # real Next.js (App Router) starter, fork for a new project
  tanstack-base/    # real TanStack Start starter, fork for a new project
cli/                # create-stack: the published installer that forks a base app
  index.mjs  lib/  templates/   # (biome.jsonc + # Author footer + wiring variants)
skills/
  create-stack/     # run the published create-stack CLI to scaffold a project
  add-capability/   # add a capability into a project behind a port
scripts/
  link-skills.sh    # symlink skills into Claude / Codex
capability.schema.json   # the manifest schema each capability.json follows
```

`apps/*-base` are **real starter apps**, the absolute references you fork for a
new project. They carry the personal baseline (strict Biome, `~/*` alias, typed
`env.ts`) and nothing app-specific; new projects are scaffolded (framework, monorepo
orchestrator, package manager, import alias, foundations) with **create-stack** (which can
rewrite the `~/*` alias to your choice), and tools are added per-project with **add-capability**.

## Development

Working on the repo itself (capabilities, CLI, bases):

```bash
pnpm install
pnpm test         # all packages
pnpm typecheck
pnpm check
```

Preview emails locally:

```bash
pnpm --filter @alfredmouelle/email-kit email:dev   # react-email studio on :3001
```

## Skills

The skills live here (versioned) and are symlinked into the agent's config, so
editing them in this repo updates what the agent uses, no copy step.

```bash
pnpm link:skills          # → Claude (~/.claude/skills)
pnpm link:skills:codex    # → Codex  (~/.codex/prompts)
```

- **`/create-stack`**: scaffold a new project by running the published
  `@alfredmouelle/create-stack` CLI (framework + foundations + mailer, installs &
  inits git).
- **`/add-capability <capability> [adapter]`**: vendor a capability into the
  current project (e.g. `/add-capability mailer resend`). Ports take an adapter
  argument, modules take none. Server capabilities land in `src/server/<cap>/`,
  pure utils in `src/lib/`, templates in `src/emails/`.

See [`skills/README.md`](./skills/README.md) for details.

## Contributing

Contributions are welcome. Please read the
[Contributing Guidelines](./CONTRIBUTING.md) before opening an issue or PR: they
cover the local setup, the ports & adapters rules, and the commit convention.

## Conventions

- **Package manager:** pnpm · **Tasks:** turbo · **Build:** tsdown · **Tests:** vitest
- **Lint/format:** Biome v2, strict (no semicolons, single quotes, trailing
  commas, `~/*` import alias)
- **Schema validation (apps):** valibot · **Typed env:** `@t3-oss/env-core`
- **Node:** >= 22

## Credits

Inspired by [create-t3-app](https://create.t3.gg) and the work of
[Theo Browne](https://github.com/t3dotgg). Not affiliated with or endorsed by
the T3 project.

## License

[MIT](./LICENSE) © Alfred MOUELLE

---

# Author

Alfred MOUELLE | FullStack Developer

[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/alfredmouelle)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)
[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)

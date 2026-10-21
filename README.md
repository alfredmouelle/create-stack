# create-stack

> A SaaS foundation and CLI for scaffolding Next.js or TanStack Start projects.
> Replaceable integrations live behind ports. Integrations with one useful provider
> ship as modules.

[![npm](https://img.shields.io/npm/v/@alfredmouelle/create-stack?color=cb3837&logo=npm&label=create-stack)](https://www.npmjs.com/package/@alfredmouelle/create-stack)
[![license](https://img.shields.io/npm/l/@alfredmouelle/create-stack?color=blue)](./LICENSE)
[![node](https://img.shields.io/node/v/@alfredmouelle/create-stack?color=339933&logo=node.js&logoColor=white)](https://nodejs.org)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)

This pnpm and Turborepo monorepo keeps replaceable integrations such as email,
storage, cache, logging, and analytics behind a **port**. Application code depends
on that port. The composition root selects the provider, so switching Resend for
Brevo or S3 for R2 stays local to one place. Jobs use Inngest directly, and error
tracking uses Sentry directly. Those integrations ship as **modules** with their
framework wiring included.

> **Two package names, one project.** `@alfredmouelle/create-stack` is the
> published CLI you install to scaffold a project. `@alfredmouelle/stack` is this
> repo: the private (unpublished) monorepo that develops and ships that CLI.

## Quickstart

Scaffold a project with the selected stack, installed dependencies, verification,
and an initial Git commit:

```bash
pnpm create @alfredmouelle/stack@latest my-app
# equivalent, explicit form (npm / yarn create also work):
pnpm dlx @alfredmouelle/create-stack@latest my-app
```

Interactive creation asks for the framework, monorepo orchestrator, package manager,
import alias, database, authentication, tRPC, mailer, formatter, linter, and capabilities. The CLI
assembles the project from the parts of the framework's reference application that
match those choices.

## Why

Every new SaaS project needs the same early work: clean the boilerplate, configure
the checks, install the common libraries, and wire the usual integrations. This
repo keeps that work in one place. The defaults are opinionated, while the
replaceable integrations stay behind adapters. Change the defaults or the generated
code to fit your project.

## Capabilities

Each `packages/<capability>/` is a self-contained capability with a
`capability.json` manifest and tests. Its `kind` field defines the wiring model:
a **port** has several adapters selected at the composition root, while a
**module** has one provider, or no provider, and is used directly.

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
| **email-ui** | composable React Email primitives + **swappable theme** + local preview (`email dev`) | n/a |
| **http** | `apiFetch` (typed fetch) + Web-standard `WebhookHandler` | n/a _(for APIs without an SDK)_ |

Design rules:

- **Pure core.** `packages/*` have zero framework code, except where the
  framework integration *is* the product (the error-tracking wiring).
- **Official SDKs** are always preferred over hand-rolled fetch (except `http`,
  whose whole job is fetch).
- **Provider selection by env var**, with static imports. Use lazy imports and
  per-adapter subexports only when an edge deployment requires them.
- **Abstract a dependency when the abstraction earns its keep.** A single obvious
  implementation stays a module. Jobs need durable steps, cron, concurrency, fan-out,
  and typed events, so the SDK remains visible. Sentry needs request hooks, source
  maps, early instrumentation, and per-request scope isolation, so a small
  `captureException` wrapper would hide the useful parts.

## Structure

```
packages/
  mailer/  email-ui/  storage/  jobs/
  cache/  logger/  analytics/  error-tracking/  http/
apps/
  next-base/        # Next.js (App Router) reference application
  tanstack-base/    # TanStack Start reference application
cli/                # create-stack: the published CLI
  index.mjs         # command line and prompts
  engine.mjs        # loads the compiled engine or its TypeScript source
  src/              # engine, framework registry, quality profile
  src/lib/          # capabilities, components, package managers, environment
  src/frameworks/   # one framework module per framework
  templates/        # variant files, quality tool configurations, Git hooks
skills/
  create-stack/     # run the published create-stack CLI to scaffold a project
  add-capability/   # add a capability into a project behind a port
scripts/
  link-skills.sh    # symlink skills into Claude / Codex
capability.schema.json   # the manifest schema each capability.json follows
```

`apps/*-base` are **reference applications**: runnable, tested apps containing
every stack part their framework supports in its recommended form. Each file
belongs to one part, and the CLI copies only the parts a configuration selects.
Every generated project then receives the same quality profile: strict TypeScript
options, Git hooks, and editor settings, with Biome or Prettier formatting and
Biome or Oxlint linting. `add-capability` adds tools after creation.

To add a framework, read [Adding a framework](./docs/adding-a-framework.md).

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
pnpm --filter @alfredmouelle/email-ui email:dev   # react-email studio on :3001
```

## Skills

The skills live here (versioned) and are symlinked into the agent's config, so
editing them in this repo updates what the agent uses, no copy step.

```bash
pnpm link:skills          # Claude (~/.claude/skills)
pnpm link:skills:codex    # Codex  (~/.codex/prompts)
```

- **`/create-stack`**: create a project with the published
  `@alfredmouelle/create-stack` CLI (framework + stack axes + capabilities, installs &
  inits git).
- **`/add-capability <capability> [adapter]`**: add a capability to the
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
- **Lint/format (repository):** Biome v2, strict (no semicolons, single quotes,
  trailing commas, `~/*` import alias). Generated projects choose Biome or
  Prettier, and Biome or Oxlint.
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
[![X](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/alfredmouelle)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)
[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)

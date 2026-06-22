# Stack

> Personal agnostic SaaS foundation — swappable capabilities behind **ports &
> adapters**, framework-agnostic, ready to drop into any new project.

A pnpm + turbo monorepo where every external tool (email, storage, jobs, cache,
logging, analytics, error tracking) lives behind a tiny **port**. App code
depends only on the port, never on a provider — so swapping Resend for Brevo, or
S3 for R2, is one line in a composition root, not a refactor.

Two companion skills turn this repo into automation: **`bootstrap`** (start a new
project on the baseline) and **`add-capability`** (drop a capability into a
project behind a port).

## Why

Every new SaaS started the same way: clean the boilerplate, set up the linter,
re-install the same libs, re-wire the same integrations. This repo captures those
patterns once, the way I like them — and the agnostic part means a tool is never
welded to the codebase: it sits behind an adapter and can be replaced wholesale.

## Capabilities

Each `packages/<capability>/` is a self-contained capability: a pure-TS port +
one adapter per provider + a `capability.json` manifest + tests. The core never
imports a framework.

| Capability | Port | Adapters |
|---|---|---|
| **mailer** ⭐ _reference_ | `send()` — body is always a React Email component, rendered to HTML + text | Resend · Brevo |
| **email-kit** | composable React Email primitives + **swappable theme** + local preview (`email dev`) | — |
| **storage** | `put` / `get` / `delete` / `exists` / `getSignedUrl` | S3 · Cloudflare R2 · GCS · local |
| **jobs** | `defineJob` / `trigger` | Inngest · in-memory |
| **cache** | `get` / `set` / `has` / `delete` / `wrap` | Redis · in-memory |
| **logger** | `trace`…`error` / `child` | pino · console |
| **analytics** | `capture` / `identify` / `flush` | PostHog · noop |
| **error-tracking** | `captureException` / `captureMessage` / `setUser` | Sentry · console |
| **http** | `apiFetch` (typed fetch) + Web-standard `WebhookHandler` | — _(for APIs without an SDK)_ |

Design rules:

- **Pure core.** `packages/*` have zero framework code — the port and adapters
  depend only on the provider SDK and Web/Node standards.
- **Official SDKs** are always preferred over hand-rolled fetch (except `http`,
  whose whole job is fetch).
- **Provider selection by env var**, static imports. (Switch to lazy import +
  per-adapter subexports only if a target deploys to the edge.)
- **Don't abstract what you won't swap** — no port for things with a single
  obvious implementation.

## Structure

```
packages/
  mailer/  email-kit/  storage/  jobs/
  cache/  logger/  analytics/  error-tracking/  http/
apps/
  with-next/        # wiring reference — Next.js (App Router) shims
  with-tanstack/    # wiring reference — TanStack Start shims
skills/
  bootstrap/        # cleanup + baseline for a new project
  add-capability/   # add a capability into a project behind a port
scripts/
  link-skills.sh    # symlink skills into Claude / Codex
capability.schema.json   # the manifest schema each capability.json follows
```

`apps/with-*` are **wiring-only** references: a typed `env.ts`, a
`server/services.ts` composition root that picks each adapter from the env, and
the framework shims (server functions, webhook mounts). Everything that isn't a
shim is identical between the two — that's the framework boundary made visible.

## Getting started

```bash
pnpm install
pnpm test         # all packages
pnpm typecheck
pnpm lint
```

Preview emails locally:

```bash
pnpm --filter @alfredmouelle/email-kit email:dev   # react-email studio on :3001
```

## Skills

The skills live here (versioned) and are symlinked into the agent's config, so
editing them in this repo updates what the agent uses — no copy step.

```bash
pnpm link:skills          # → Claude (~/.claude/skills)
pnpm link:skills:codex    # → Codex  (~/.codex/prompts)
```

- **`/bootstrap`** — strip a fresh project's boilerplate and apply the baseline
  (strict Biome, tsconfig, typed env, `~/*` alias).
- **`/add-capability <capability> <adapter>`** — vendor a capability into the
  current project behind a port (e.g. `/add-capability mailer resend`). Server
  capabilities land in `src/server/<cap>/`, pure utils in `src/lib/`, templates
  in `src/emails/`.

See [`skills/README.md`](./skills/README.md) for details.

## Conventions

- **Package manager:** pnpm · **Tasks:** turbo · **Build:** tsdown · **Tests:** vitest
- **Lint/format:** Biome v2, strict (no semicolons, single quotes, trailing
  commas, `~/*` import alias)
- **Config validation:** valibot · **Typed env:** `@t3-oss/env-core`
- **Node:** >= 22

---

# Author

Alfred MOUELLE | FullStack Developer

[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/kali47_)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)
[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)

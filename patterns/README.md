# Patterns

Foundational, framework-coupled **patterns** the `bootstrap` skill vendors into a
freshly scaffolded app — the counterpart to `packages/` (swappable capabilities).

A *capability* is a provider behind a port (mailer, storage, …), swappable by
changing one line. A *pattern* is a foundation you don't swap but always set up
the same way: tRPC wiring, the better-auth instance, the Drizzle client. They are
**framework-coupled** (currently `tanstack-start`, mirrored from the reference
base apps) and depend on each other.

**The code lives in the base apps, not here.** `patterns/` is a pure *manifest
layer*: each `pattern.json` describes a foundation (how to detect it, its deps,
env, framework, dependencies) and lists the files that make it up — by pointing
**into the base apps** (`apps/tanstack-base`, `apps/next-base`), the single source
of truth. No code is duplicated.

Each pattern is `<name>/pattern.json` (see `../pattern.schema.json`).
`_baseline/` is special: real always-applied config files (Biome, tsconfig, env
skeleton, the `# Author` README footer) that a standalone fork needs but the base
apps don't carry on their own (they inherit the monorepo's Biome).

## How the skills use these

The manifests drive two flows:

- **bootstrap — create mode** (empty folder): fork a base app, then *strip* every
  foundation/capability the user didn't pick, using each manifest's `files`/`deps`/
  `env` to know its exact footprint.
- **bootstrap — existing project / add-capability**: match each manifest's `detect`
  against the project → the opt-in set, then *vendor* the listed files (copied from
  the base apps) + deps + env, wire `integratesWith` when both sides are opt-in, and
  pull required `capabilities`. A pattern not referenced is never pulled.

## Available patterns

- **drizzle** — Drizzle ORM + drizzle-kit (Postgres). Client, schema barrel,
  cursor pagination, seed harness.
- **better-auth** — better-auth v1 with the Drizzle adapter. Email+password,
  verification, optional Google OAuth, rate limiting, auth tables, client +
  session helpers, route guard. `dependsOn` drizzle; needs the mailer + email-kit
  capabilities.
- **trpc** — tRPC v11 + TanStack React Query. Context, procedure tiers, error
  formatter, client + SSR caller, fetch handler. `dependsOn` drizzle,
  `integratesWith` better-auth.
- **data-table** — headless tables with TanStack Table (table + skeleton
  primitives, DataTable, InfiniteDataTable, SortableHeader). `framework: agnostic`
  — works in both Next and TanStack Start.

Next.js variants (App Router) of the framework-coupled patterns:

- **better-auth-next** — better-auth with `next/headers` session, `toNextJsHandler`
  catch-all, server-component guards (`requireAuth`).
- **trpc-next** — tRPC with the classic `api.x.useQuery` hooks (createTRPCReact) +
  RSC hydration. `integratesWith` better-auth-next.

bootstrap picks the variant matching the project's framework: `trpc`/`better-auth`
for TanStack Start, `trpc-next`/`better-auth-next` for Next.

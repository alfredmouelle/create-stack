# Patterns

Foundational, framework-coupled **patterns** the create-stack CLI reads to strip a
forked base app down to the selected foundations — the counterpart to `packages/`
(swappable capabilities).

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

## How create-stack uses these

The create-stack CLI forks a base app (the maximal foundation), then *strips* every
foundation the user didn't pick — using each manifest's `files`/`deps`/`env`/`scripts`
to know its exact footprint, and `framework` to pick the right variant. `_baseline/`
supplies the standalone config a fork needs (Biome, tsconfig, env, the `# Author`
footer). The `add-capability` skill uses the `packages/*` capability manifests
separately. (The `detect`/`cleanup` fields are legacy — the dropped "convert an
existing project" flow no longer runs.)

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

create-stack picks the variant matching the chosen framework: `trpc`/`better-auth`
for TanStack Start, `trpc-next`/`better-auth-next` for Next.

# Patterns

Foundational, framework-coupled **patterns** the `bootstrap` skill vendors into a
freshly scaffolded app — the counterpart to `packages/` (swappable capabilities).

A *capability* is a provider behind a port (mailer, storage, …), swappable by
changing one line. A *pattern* is a foundation you don't swap but always set up
the same way: tRPC wiring, the better-auth instance, the Drizzle client. They are
**framework-coupled** (currently `tanstack-start`, mirrored from the reference
base apps) and depend on each other.

Each pattern is `<name>/` with:

- `pattern.json` — manifest (see `../pattern.schema.json`) driving detection,
  deps, env, files and wiring.
- `files/` — the genericized reference source to vendor (the stack's conventions,
  business logic stripped). Layout mirrors the destination tree.

`_baseline/` is special: always-applied config (Biome, tsconfig, env skeleton),
not an opt-in pattern.

## How bootstrap uses these

1. Reads the target project and matches each pattern's `detect` against the
   installed deps / config files → the **opt-in set**.
2. Vendors only opt-in patterns (+ their hard `dependsOn`). A pattern present in
   the stack but not referenced in the project is **never** pulled.
3. Wires patterns that `integratesWith` each other only when both are opt-in.
4. Pulls the `capabilities` an opt-in pattern needs via the add-capability skill.

These files are inert templates: they import deps (`@trpc/server`, `better-auth`,
`drizzle-orm`, `~/…`) that don't exist in this repo, so `patterns/` is excluded
from the stack's Biome / typecheck. Their correctness is anchored in the base apps
(`apps/tanstack-base`, `apps/next-base`), which wire them for real.

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

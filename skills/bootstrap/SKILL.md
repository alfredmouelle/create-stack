---
name: bootstrap
description: >-
  Turns a freshly scaffolded project (TanStack Start starter, T3 / create-next-app,
  any wizard) into one that follows the personal reference stack. Detects which
  packages were opt-in (trpc, better-auth, drizzle, biome, …), strips the CLI's
  example boilerplate, then vendors the matching patterns + conventions from the
  stack — file naming, folder layout, real boilerplate — only for what was opt-in.
  Finishes by freshening deps and stamping author info. Trigger right after a
  scaffold: "initialise le projet", "mets en place ma base", "cleanup le
  boilerplate", "bootstrap". Pairs with add-capability for swappable tools.
---

# Bootstrap a new project

Make a freshly scaffolded app follow the **reference stack**: detect what the
wizard installed, clean its examples, and pull *your* patterns (the stack is the
source of truth) — but only for the packages that were actually opt-in.

## Reference stack location

Default: `/Users/alfredmouelle/Developer/stack`. Override with `$STACK_REPO`.
Verify it exists first:

```bash
STACK=${STACK_REPO:-/Users/alfredmouelle/Developer/stack}
ls "$STACK/patterns" "$STACK/packages" || echo "MISSING: ask where the reference stack is"
```

Two sources of truth in the stack:
- **`patterns/<name>/pattern.json`** — foundational, framework-coupled patterns
  (`trpc`, `better-auth`, `drizzle`). `_baseline/` holds always-on config.
- **`packages/<cap>/capability.json`** — swappable capabilities (mailer, storage,
  jobs, …), added via the **add-capability** skill.

Both manifests drive this skill — read them, don't hardcode.

## Step 1 — Detect framework + the opt-in set

Read the project (never guess):
- **Framework**: `next` (T3 / create-next-app) vs `@tanstack/react-start`.
- **Package manager**: `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lockb`.
- **Source root + alias**: `src/` + the tsconfig path (personal convention is
  always `~/*`, never `@/*`).

Then compute the **opt-in set** by matching every pattern + capability manifest's
`detect` against the project — a match if any `detect.deps` is in the project's
`package.json` or any `detect.files` exists:

```bash
for m in "$STACK"/patterns/*/pattern.json "$STACK"/packages/*/capability.json; do cat "$m"; done
```

A pattern present in the stack but **not** referenced in the project is never
pulled (e.g. the stack knows qstash, the project has no qstash → skip it).

## Step 2 — Announce

Tell the user what you found and what you'll do, e.g.:

> Tu viens de démarrer un projet **TanStack Start** avec **better-auth, trpc,
> drizzle**. Je nettoie les exemples du CLI puis je récupère tes patterns depuis
> la stack.

## Step 3 — Clean the CLI boilerplate

Remove the starter's demo content while keeping the app bootable. **Auto-remove**
recognized boilerplate; **confirm** anything ambiguous or that you didn't identify
as starter output:
- Demo home page → minimal placeholder; demo components/assets, example API
  routes, `public/` demo SVGs, comment banners, marketing README.
- Each opt-in pattern's `cleanup` globs (its CLI-generated example, e.g. a
  starter's throwaway tRPC `post` router) — these are listed in `pattern.json`.

## Step 4 — Baseline (always applied)

From `$STACK/patterns/_baseline/`, adapted to the framework:
- **Biome v2 strict** — copy `biome.jsonc`; add `includes` ignores for the
  framework's generated files (`.next`/`.output`, `routeTree.gen.ts`). Then
  `pnpm add -D -E @biomejs/biome`. (If the user explicitly wants ESLint+Prettier,
  set up the strictest equivalent instead — never both.)
- **tsconfig** — align with `tsconfig.json` (strict, `verbatimModuleSyntax`,
  `noUnusedLocals/Parameters`, `noUncheckedSideEffectImports`); keep the
  framework's required options (jsx, plugins). Ensure the `~/*` → `src/*` alias
  exists in tsconfig **and** the bundler (vite `tsconfigPaths`, etc.).
- **Typed env** — copy `env.ts` (`@t3-oss/env-core` + valibot, the
  `requiredInProduction` helper). `pnpm add @t3-oss/env-core valibot`. Patterns
  and capabilities extend it.
- **Folders** — create the baseline the conventions use: `src/lib/`,
  `src/server/`, `src/emails/`.

## Step 5 — Vendor the opt-in patterns

For each pattern in the opt-in set, plus its hard `dependsOn` (transitively, even
if a dependency wasn't independently detected — e.g. better-auth pulls drizzle):

1. **Copy files** — for every `files[]` entry, copy `from` → `to`, expanding
   `<srcRoot>` to the project's source root:
   ```bash
   cp "$STACK/patterns/<name>/<from>" "<srcRoot-expanded>/<to>"
   ```
2. **Deps / scripts / env** — install `deps` + `devDeps` with the project's
   package manager; merge `scripts` into `package.json`; add each `env` var to
   `.env.example` (+ empty `.env`) and as a validated entry in `env.ts` (mirror
   the baseline style).
3. **Capabilities** — for each name in the pattern's `capabilities`, run the
   **add-capability** skill (e.g. better-auth → `mailer`, `email-kit`). Create any
   referenced template that's missing (e.g. `~/emails/verify-email`).
4. **Wiring** — perform each step in `wiring` (e.g. append
   `export * from './auth.schema'` to the drizzle schema barrel).
5. **Integrations** — for each name in `integratesWith` that is **also** opt-in,
   keep the integration; if it's **not** opt-in, strip it per the manifest's
   `notes` (e.g. trpc without better-auth → drop the `auth`/`session` lines and the
   protected/staff/admin procedures, keep `publicProcedure`).
6. **Framework fit** — the reference files target `pattern.framework`
   (`tanstack-start`). On Next.js, adapt only the framework shims (route handlers:
   `createFileRoute` → an App Router `route.ts`); the core logic is unchanged.
   Rewrite any leftover `~/` import to the project's actual alias.

## Step 6 — Freshen dependencies

Bring everything to current versions before finishing: check the installed majors
against the latest (find-docs / `ctx7`, or `npm view <pkg> version`) and update
`package.json` + lockfile. Flag any major bump that needs a code change.

## Step 7 — Stamp identity

Pull the author block from the stack as the source of truth:

```bash
node -e "console.log(JSON.stringify(require('$STACK/package.json').author))"
```

Apply it to the new project:
- `package.json` — set `author` (name/email/url) and a real `name`/`description`.
- `README.md` — replace starter marketing with a short project README under the
  author's name.
- **Meta tags** — set the author/og/site metadata in the framework's head config
  (Next `metadata` export / `<head>`, TanStack root route `head`/`meta`).

## Step 8 — Verify + report

- Run typecheck + `biome check`; fix until clean.
- Boot check the app still starts.
- Report concisely: framework, the opt-in set pulled, what was cleaned, deps
  bumped, env vars to fill, and the next step ("add a tool with add-capability").

## Guardrails

- Keep the app bootable at every step; never delete what you can't identify as
  starter boilerplate (confirm first).
- **Only opt-in**: never vendor a stack pattern/capability the project doesn't
  reference — except a hard `dependsOn` of something that is opt-in.
- The stack is the source of truth for conventions; match the project's existing
  alias/env/formatter when they already diverge intentionally.
- Respect an explicit linter choice (Biome vs ESLint+Prettier) — never both.
- Leave no dangling `~/` or `@alfredmouelle/*` import; rewrite to the project's alias.

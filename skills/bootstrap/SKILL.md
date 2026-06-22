---
name: bootstrap
description: >-
  Bootstraps a project to follow the personal reference stack — in two
  auto-detected modes. CREATE mode (run in an empty folder): a guided wizard asks
  framework + which foundations (trpc, better-auth, drizzle, data-table) and
  capabilities (mailer, storage, jobs, …) you want, then forks a base app and
  strips it down to your selection — a from-scratch guided installer. CONVENTION
  mode (run in an existing scaffold, e.g. right after create-next-app / TanStack
  Start): detects what was opt-in, cleans the CLI's examples, and vendors the
  matching patterns + baseline. Trigger: "initialise un projet", "nouveau projet",
  "bootstrap", "mets en place ma base", "cleanup le boilerplate". Pairs with
  add-capability for swappable tools.
---

# Bootstrap a project

Two modes, auto-detected (Step 0):

- **Create mode** — run in an empty folder → a guided wizard, then a base app is
  forked and stripped to your selection. The from-scratch installer.
- **Convention mode** — run in an existing scaffold → detect what's opt-in, clean
  the CLI examples, vendor matching patterns + the baseline.

## Reference stack location

Default: `/Users/alfredmouelle/Developer/stack`. Override with `$STACK_REPO`.

```bash
STACK=${STACK_REPO:-/Users/alfredmouelle/Developer/stack}
ls "$STACK/patterns" "$STACK/packages" "$STACK/apps" || echo "MISSING: ask where the reference stack is"
```

Sources of truth:
- **Base apps** `$STACK/apps/{tanstack-base,next-base}` — real, fully-wired apps;
  the single source of truth for code.
- **`patterns/<name>/pattern.json`** — manifest layer over the base apps: detect,
  deps, env, framework, dependencies, and the `files[]` (whose `from` points into
  the base apps). `_baseline/` holds standalone config (Biome, tsconfig, env,
  `# Author` footer).
- **`packages/<cap>/capability.json`** — swappable capabilities (add-capability).

Read the manifests — never hardcode.

## Step 0 — Pick the mode

Is the current directory an existing project (a real `package.json`, ignoring an
empty/placeholder one)?
- **Empty / no project** → **Create mode** (§A).
- **Existing scaffold/app** → **Convention mode** (§B).

---

# §A — Create mode (empty folder → guided installer)

## A1. Wizard

Ask with the question tool (sensible defaults, multi-select where it fits):
- **Framework**: Next.js App Router | TanStack Start.
- **Foundations** (multi): `drizzle`, `better-auth`, `trpc`, `data-table`.
  Resolve hard deps for the user: `better-auth` ⇒ `drizzle` + the `mailer` &
  `email-kit` capabilities; `trpc` ⇒ `drizzle`.
- **Capabilities** (multi) + a provider each: mailer (resend/brevo/ses), storage
  (s3/r2/gcs/local), jobs (inngest/trigger/memory), cache (redis/memory), logger
  (pino/console), analytics (posthog/plausible/noop), error-tracking
  (sentry/console).
- **Project name** (the author is always the stack's — see A4).

## A2. Fork the base

```bash
BASE="$STACK/apps/$( [ next ] && echo next-base || echo tanstack-base )"
# copy the app into the cwd, minus build output & generated files
rsync -a --exclude node_modules --exclude .next --exclude .output \
  --exclude .nitro --exclude .tanstack --exclude dist \
  --exclude 'src/routeTree.gen.ts' "$BASE/." .
```
Then:
- Copy a **standalone** `biome.jsonc` from `$STACK/patterns/_baseline/` (the base
  apps inherit the monorepo's root config, a fork needs its own).
- `package.json`: set `name` to the project (drop the `@alfredmouelle/` scope),
  keep `author`, drop monorepo-only bits.

The base is the **maximal foundation** (baseline, shadcn, drizzle, better-auth,
mailer, email-kit, trpc, data-table, theme toggle, date pickers, Dockerfile). A3
strips down; A5 adds any selected capability the base doesn't already carry.

## A3. Strip what wasn't selected (manifests drive it)

For each **foundation pattern NOT selected** (and not a hard `dependsOn` of a
selected one), reverse its manifest:
- delete its `files[].to` paths from the fork,
- remove its `deps`/`devDeps`/`scripts` from `package.json`, its `env` from
  `env.ts` + `.env.example`,
- undo its `wiring` (e.g. the `export * from './auth.schema'` barrel line, the
  provider wrapper in the root) and any `integratesWith` lines per the manifest
  `notes` (e.g. drop the better-auth `session` from the tRPC context, keep
  `publicProcedure`).

Capabilities baked into the base: **mailer + email-kit** (needed by better-auth).
If `better-auth` is dropped **and** the user didn't select mailer, remove
`src/server/email`, `src/emails/*`, the auth UI (`app/auth` / `routes/auth*`,
`_authed`, guards) and the related deps. If `better-auth` is dropped, also remove
the auth pages/components regardless.

## A4. Identity

Set the project `name`/`description` in `package.json`; set head/meta (Next
`metadata` / TanStack root `head`); write a short README ending with the `# Author`
footer **verbatim** from `$STACK/patterns/_baseline/README-author.md`.

## A5. Add the rest → then §C

For each selected capability **not already in the base** (storage, jobs, cache,
logger, analytics, error-tracking), run **add-capability** with the chosen
provider. Then go to **§C (Freshen + verify)**.

---

# §B — Convention mode (existing scaffold)

## B1. Detect framework + the opt-in set

Read the project (never guess): framework (`next` vs `@tanstack/react-start`),
package manager (lockfile), source root + alias (`~/*`, never `@/*`). Compute the
**opt-in set** by matching every manifest's `detect` against the project (a dep in
`package.json` or a `detect.files` path exists):

```bash
for m in "$STACK"/patterns/*/pattern.json "$STACK"/packages/*/capability.json; do cat "$m"; done
```
A pattern present in the stack but not referenced is **never** pulled.

## B2. Announce

> Tu viens de démarrer un projet **TanStack Start** avec **better-auth, trpc,
> drizzle**. Je nettoie les exemples du CLI puis je récupère tes patterns.

## B3. Clean the CLI boilerplate

Auto-remove recognized boilerplate (demo page → placeholder, demo assets/components,
example API routes, marketing README, comment banners); confirm anything ambiguous.
Apply each opt-in pattern's `cleanup` globs.

## B4. Baseline

From `$STACK/patterns/_baseline/`, adapted to the framework: strict **Biome**
(`biome.jsonc`, add ignores for generated files), **tsconfig** (strict,
`verbatimModuleSyntax`, `~/* → src/*` alias in tsconfig **and** bundler), **typed
env** (`env.ts`), and the baseline folders (`src/lib`, `src/server`, `src/emails`).

## B5. Vendor the opt-in patterns

For each opt-in pattern (+ its hard `dependsOn`, transitively — e.g. better-auth
pulls drizzle):
1. **Copy files** — for every `files[]` entry, copy from the stack (its `from`
   already points at a base app) to the project, expanding `<srcRoot>`:
   ```bash
   cp "$STACK/<from>" "<srcRoot-expanded>/<to>"
   ```
2. **Deps / scripts / env** — install `deps` + `devDeps`; merge `scripts`; add each
   `env` to `.env.example` (+ empty `.env`) and a validated entry in `env.ts`.
3. **Capabilities** — for each name in `capabilities`, run **add-capability**;
   create any referenced template that's missing.
4. **Wiring** — perform each `wiring` step (e.g. append the auth.schema barrel
   export; wrap the root in the tRPC provider — see the matching base app's
   `router.tsx` / `app/layout.tsx`).
5. **Integrations** — keep an `integratesWith` only when the other side is also
   opt-in; otherwise strip per the manifest `notes`.
6. **Framework variant** — pick the manifest whose `framework` matches: `trpc` /
   `better-auth` for TanStack Start, `trpc-next` / `better-auth-next` for Next;
   `drizzle` / `data-table` are `agnostic`. Rewrite any leftover `~/` import to the
   project's alias.

## B6–B8 → §C

Freshen deps, stamp identity (A4), verify (§C).

---

# §C — Freshen + verify (both modes)

- **Freshen** — bring deps to current majors (find-docs / `ctx7`, or
  `npm view <pkg> version`); flag any major bump needing a code change.
- **Install + verify** — install with the project's package manager; run typecheck
  + `biome check`; fix until clean; boot-check the app starts.
- **Report** — concise: mode, framework, foundations/capabilities set up (or
  stripped), env vars to fill, and the next step ("add a tool with add-capability").

## Guardrails

- Keep the app bootable at every step; never delete what you can't identify (confirm).
- **Only what's selected/opt-in**: never keep or vendor a foundation/capability the
  user didn't pick — except a hard `dependsOn` of something selected.
- The stack is the source of truth; match the project's existing alias/env/formatter
  when they already diverge intentionally.
- Respect an explicit linter choice (Biome vs ESLint+Prettier) — never both.
- Leave no dangling `~/` or `@alfredmouelle/*` import; rewrite to the project's alias.

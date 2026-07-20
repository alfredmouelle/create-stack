---
name: add-capability
description: >-
  Add a capability (mailer, storage, cache, logger, analytics, jobs,
  error-tracking, email-kit, http) into the current project: ports get a
  swappable adapter, modules use their single provider directly. Use when the
  user wants to add a tool/integration ("ajoute Resend", "intègre le storage R2",
  "mets en place les jobs Inngest").
---

# Add a capability (ports & modules)

Adds one capability to the current project from the reference stack. The
reference always comes from **`@alfredmouelle/create-stack`** (the `create-stack`
binary if installed, else `pnpm dlx`, it bundles the whole `_stack/`), or the
**public repo** `https://github.com/alfredmouelle/create-stack` for the manual
fallback. No local checkout, no machine-specific path to break.

## Two kinds of capability, `kind` in `capability.json` decides

- **Port** (no `kind` field, has `port` + `adapters`): several providers behind
  one interface, swappable at the composition root by changing one line + env.
  `storage` (s3 / r2 / gcs / local), `cache` (redis / upstash / memory),
  `logger` (pino / console), `analytics` (posthog / plausible / noop), and
  `mailer` (resend / brevo / ses, which keeps its own vendoring engine).
- **Module** (`"kind": "module"`): a single provider used directly, no adapter to
  pick and none to pass. `jobs` (Inngest SDK), `error-tracking` (Sentry), plus
  `http` and `email-kit` which have no provider at all.

Passing an adapter to a module is an error the CLI raises explicitly, so never
write `cs add jobs inngest`.

## Which CLI to run: installed binary, else `pnpm dlx`

```bash
cs() { if command -v create-stack >/dev/null 2>&1; then create-stack "$@";
       else pnpm dlx @alfredmouelle/create-stack@$(npm view @alfredmouelle/create-stack version) "$@"; fi; }
```

Define the `cs` helper and call `cs …` **in the same command block**: a fresh shell
per bash call won't keep the function. The fallback resolves the version explicitly,
`@latest` can be served stale from the `pnpm dlx` cache, which has no `--force`.

## Prefer the CLI, it does everything, self-contained

The CLI vendors any capability deterministically from its bundled `_stack/`. Run it
**in the target project**:

```bash
cs add <capability> [adapter]   # adapter: ports only
cs add                          # interactive multi-select
cs add storage r2
cs add cache upstash            # re-add = swap the adapter
cs add cache upstash --keep     # keep the old adapter too
cs add jobs                     # module: no adapter argument
cs add error-tracking           # idem
```

It covers every capability (`storage`, `cache`, `logger`, `analytics`, `mailer`,
`jobs`, `error-tracking`, `email-kit`, `http`), detecting the framework, vendoring
the port + adapter or the module wiring, merging deps/env, installing + verifying,
and printing the manual steps it deliberately left to you. For a
create-stack-generated project (and most others), **this is the whole skill**:
run it, then report, manual steps included.

## Manual vendoring, only when the CLI can't

Fall back to the steps below **only when** the CLI can't: the project diverged
from the create-stack conventions (non-`~/` alias, hand-edited `env.ts`), an SDK
is already installed at a different major (verify with find-docs and align), the
project isn't a create-stack scaffold at all, or the integration needs judgement
the CLI doesn't make.

### Get the reference: shallow-clone the public repo

Shallow-clone the public repo into a throwaway dir; `$STACK/packages/<capability>/`
is the source of truth:

```bash
STACK=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/alfredmouelle/create-stack "$STACK"
git -C "$STACK" sparse-checkout set packages apps
ls "$STACK/packages"   # capabilities available
```

Each capability lives in `$STACK/packages/<capability>/` with a `capability.json`
manifest that drives the rest. Available: `mailer`, `email-kit`, `storage`, `jobs`,
`cache`, `logger`, `analytics`, `error-tracking`, `http`. (You can also read a
single manifest without cloning via
`https://raw.githubusercontent.com/alfredmouelle/create-stack/main/packages/<capability>/capability.json`.)

### Step 1: resolve capability + kind (+ adapter for a port)

Parse the user request (and any skill args like `mailer resend`):
- **capability**: which package. If ambiguous, list the capabilities above and ask.
- **kind**: read it from the manifest, it decides everything below.
- **adapter** (ports only): which provider. If not stated, read `defaultAdapter`
  from the manifest and tell the user you're using it (they can override). A
  module has none, don't invent one.

```bash
cat "$STACK/packages/<capability>/capability.json"
```

A port manifest:
```json
{
  "name": "mailer",
  "port": "src/port.ts",
  "defaultAdapter": "resend",
  "adapters": {
    "resend": { "deps": ["resend"], "env": ["RESEND_API_KEY"], "files": ["src/adapters/resend.ts"] }
  },
  "sharedDeps": ["react-email"],
  "peerDeps": ["react", "react-dom"],
  "sharedFiles": ["src/port.ts", "src/address.ts", "src/factory.ts", "src/index.ts"]
}
```

A module manifest: `kind: "module"`, a flat `files` list, a `provider` (`inngest`,
`sentry`) or none at all, `deps`/`env` at the top level, plus optional
`frameworks.<next|tanstack>.deps` and `versions` pins (the Sentry SDKs).

The package layout is flat: `src/port.ts` and `src/adapters/<name>.ts`. There is
no `src/core/`, no per-adapter directory, and no valibot config schema (adapter
options are plain typed args, validated inline where a value must be non-empty).
`valibot` is not a capability dependency.

### Step 2: understand the target project

Detect, by reading the project (not guessing):
- **Package manager**: `pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lockb`.
- **Framework**: `next` (App Router → `app/` route handlers + `'use server'`) vs
  `@tanstack/react-start` (TanStack Start → `createFileRoute` + `createServerFn`).
  Each capability's README carries the exact per-framework wiring snippet; the
  base apps `$STACK/apps/next-base` and `$STACK/apps/tanstack-base` show a
  realistic composition root. Read the capability README (+ the matching base app
  when a capability has an HTTP surface) before wiring.
- **Source root + alias**: `src/` with a `~/*` tsconfig path (the personal
  convention is always `~/*`, never `@/*`). Use it for the vendored destination.
- **Existing env approach**: a typed `env.ts` (`@t3-oss/env-core` + valibot/zod)?
  Or raw `process.env`? Match it.
- **Collision**: does the project already have this capability (a dep installed,
  or a dir like `src/server/email/`, `src/server/jobs/`)? If so, STOP and ask:
  skip / replace / coexist. Never silently overwrite or duplicate.
- **SDK version**: if a dep is already installed at a different major than the
  adapter targets (e.g. `resend` v6 vs an adapter written for v4), flag it and
  align to the installed/latest version before vendoring.

### Step 3: vendor the code (own it, don't depend on it)

The reference packages are distributed only inside the CLI / the public repo you
just cloned. Integration **copies the source** into the project so the project
owns and can tweak it, that's the whole agnostic point.

**Destination depends on the capability's nature** (the personal layout:
`src/server/<cap>/`, `src/lib/http/`, `src/emails/`):

| Capability | Destination | Why |
|---|---|---|
| storage, cache, logger, analytics, jobs, error-tracking | `<srcRoot>/server/<capability>/` | **server-only**: uses secrets + node SDKs, must never reach the client bundle |
| mailer | `<srcRoot>/server/email/` | server-only, and the base app already owns that folder |
| email-kit | `<srcRoot>/emails/components/` | React Email templates/primitives |
| http (`apiFetch`, response helpers) | `<srcRoot>/lib/http/` | **pure**, runs client or server |

If the project already has a folder for this concern, vendor into / merge with it
rather than creating a parallel dir, see the collision check in Step 2.

Copy into the destination, stripping the leading `src/` from each manifest path:
- **port**: every path in `sharedFiles` plus the chosen adapter's `files`.
- **module**: every path in `files` (there is nothing else to choose).

```bash
DEST="<srcRoot>/server/<capability>"   # or server/email, lib/http, emails/components
mkdir -p "$DEST"
# port:   sharedFiles + adapters.<adapter>.files
# module: files
cp "$STACK/packages/<capability>/src/port.ts" "$DEST/port.ts"
cp "$STACK/packages/<capability>/src/adapters/<adapter>.ts" "$DEST/adapters/<adapter>.ts"
```

Do NOT copy other adapters, tests, README, tsconfig, or package.json.

Package sources use NodeNext `.js` specifiers on relative imports (for tsdown).
Strip the extension on the vendored copies, app bundlers expect extensionless.

**Cross-package imports**: some capabilities import another (`@alfredmouelle/http`,
`@alfredmouelle/email-kit`). Grep the copied files for `@alfredmouelle/`:
```bash
grep -rn "@alfredmouelle/" "$DEST"
```
For each referenced `@alfredmouelle/<x>`: recursively add it too (same process, into its
own destination per the table above), then rewrite the import from `@alfredmouelle/<x>`
to the project's `~/` alias path. Leave no `@alfredmouelle/*` import behind.

### Step 4: install dependencies (current versions)

Collect the deps: a port takes `sharedDeps` + the chosen adapter's `deps`, a
module takes `deps` + `frameworks.<framework>.deps` (+ `peerDeps` in both cases if
the project lacks them). Honour any `versions` pin in the manifest. Before
installing, confirm the **current** major via the find-docs skill / `ctx7` when the
SDK API matters (the vendored code targets a specific API shape, flag any
mismatch). Install with the detected package manager:

```bash
pnpm add <deps...>        # or npm install / yarn add / bun add
```

### Step 5: wire env

For each var in the manifest's `env` (adapter-level for a port, top-level for a
module), plus a `<CAPABILITY>_PROVIDER` selector when it helps:
- Append to `.env.example` (and `.env` / `.env.local` with empty values).
- If the project has a typed `env.ts`, add validated entries (mirror the style in
  `$STACK/apps/*-base/src/env.ts`: `optionalString`, picklist for the provider).

### Step 6: wire it

**Port.** Write the composition root as the destination's `index.ts`: a lazy
singleton that builds the adapter on first use and returns the port type, so the
app boots without the env vars. Mirrors what the CLI generates and what
`$STACK/apps/*-base/src/server/email/index.ts` does:

```ts
import { redisAdapter } from './adapters/redis'
import type { CachePort } from './port'

let instance: CachePort | null = null
export function getCache(): CachePort {
  if (!instance) instance = redisAdapter({ url: env.REDIS_URL })
  return instance
}
```

App code imports the **port** from here, never an adapter directly. Swapping later
is one import + one call.

**Module.** There is no root to generate, the wiring is provider-specific. Follow
`$STACK/packages/<capability>/README.md`:

- **jobs**: `src/server/jobs/index.ts` (the `Inngest` client), `events.ts`
  (`eventType` + `staticSchema`), `functions.ts`
  (`jobs.createFunction({ id, triggers: [{ event }] }, handler)`, the **two**-argument
  v4 form) and the vendored `serve.ts` (`jobsHandler({ client, functions })`).
  Mount the route: `src/app/api/inngest/route.ts` exporting `GET`/`POST`/**`PUT`**
  (Inngest syncs the function list on PUT), or `src/routes/api/inngest.ts` with
  `createFileRoute`. Trigger with `jobs.send(myEvent.create(data))`. `signingKey`
  is not a `serve()` option in v4: put it on the client or leave it to
  `INNGEST_SIGNING_KEY`.
- **error-tracking**: the module only exports `sentryOptions()` (the `Sentry.init`
  options shared by every runtime). Write the Sentry files per framework. Next:
  `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts`
  (with `onRequestError`), `src/instrumentation-client.ts` (with
  `onRouterTransitionStart`), `src/app/global-error.tsx`. TanStack:
  `instrument.server.mjs` and `src/instrument.client.tsx`. Then apply the manual
  steps below. App code calls `Sentry.captureException` directly.

**Manual steps.** Some wiring edits files the project owns, so the CLI prints them
instead of rewriting them (`MANUAL_STEPS` in `cli/lib/capabilities.mjs`). Do them
yourself here, or hand them to the user. For error-tracking today:

- Next: wrap `next.config.ts` with `withSentryConfig`; set `SENTRY_AUTH_TOKEN` in
  CI for source-map upload.
- TanStack: add `sentryTanstackStart()` as the **last** plugin in `vite.config.ts`;
  import `./instrument.client` first in `src/client.tsx`; wrap the fetch handler in
  `src/server.ts` with `wrapFetchWithSentry`; add
  `sentryGlobalRequestMiddleware` / `sentryGlobalFunctionMiddleware` in
  `src/start.ts`; run with `NODE_OPTIONS='--import ./instrument.server.mjs'`.

### Step 7: verify

- Typecheck (`tsc --noEmit` or the project's script). Resolve any leftover
  `@alfredmouelle/*` import or missing dep.
- If the project runs biome/eslint, format the new files to match.
- Report to the user, concise: capability (+ adapter for a port), files vendored,
  deps installed, env vars to fill, remaining manual steps, and for a port the
  one-line swap to change provider later.
- Remove the throwaway clone: `rm -rf "$STACK"`.

## Guardrails

- Never leave a dangling `@alfredmouelle/*` import: vendor the dependency or rewrite it.
- Don't invent SDK calls; the vendored code is the source of truth, and verify
  the SDK's current API with find-docs when in doubt.
- Don't turn a module into a port. `jobs` and `error-tracking` were ports and the
  seam was removed on purpose: it hid durable steps, cron, fan-out, typed events,
  `onRequestError`, source maps and auto-instrumentation. No `JobsPort`,
  `defineJob`, `trigger`, `ErrorTrackingPort`, no trigger.dev / memory / console
  adapter. They are gone, don't reintroduce them.
- Don't abstract what isn't being swapped: integrate only the requested capability.
- Match the project's existing conventions (alias, env style, formatter) over the
  reference repo's when they differ.
- Never reference a local checkout or a machine-specific path: the reference is
  always the published package (CLI) or a fresh clone of the public repo.

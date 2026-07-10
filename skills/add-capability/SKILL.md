---
name: add-capability
description: >-
  Add a swappable capability (mailer, storage, jobs, cache, logger, analytics,
  error-tracking, email-kit, http) into the current project behind a port, using
  a chosen provider/adapter. Use when the user wants to add a tool/integration in
  an agnostic way ("ajoute Resend", "intègre le storage R2", "mets en place les
  jobs Inngest").
---

# Add a capability (ports & adapters)

Adds one capability to the current project from the **reference stack**, wired
behind a port so the provider is swappable later by changing one line + env vars.

## Prefer the CLI for create-stack projects

If the target is a **create-stack-generated project** and you want a standard
capability/adapter, use the CLI — it does all of the below deterministically:

```bash
create-stack add <capability> [adapter]   # e.g. create-stack add storage r2
create-stack add                          # interactive multi-select
create-stack add cache upstash            # re-add = swap the adapter
create-stack add cache upstash --keep     # keep the previous adapter alongside
```

It covers every capability here — `storage`, `cache`, `jobs`, `logger`,
`analytics`, `error-tracking`, `mailer`, `email-kit`, `http` — detecting the
framework, vendoring behind the port, merging deps/env, and installing + verifying.

**Use this skill instead when** the CLI can't: the project diverged from the
create-stack conventions (non-`~/` alias, hand-edited `env.ts`), an SDK is already
installed at a different major (verify with find-docs and align), the project isn't
a create-stack scaffold at all, or the integration needs judgement the CLI doesn't make.

## Reference stack location

Default: `/Users/alfredmouelle/Developer/stack`. Override with `$STACK_REPO` if
set. Verify it exists before anything:

```bash
STACK=${STACK_REPO:-/Users/alfredmouelle/Developer/stack}
ls "$STACK/packages" || echo "MISSING: ask the user where the reference stack is"
```

Each capability lives in `$STACK/packages/<capability>/` with a
`capability.json` manifest that drives this whole skill. Available capabilities:
`mailer`, `email-kit`, `storage`, `jobs`, `cache`, `logger`, `analytics`,
`error-tracking`, `http`.

## Step 1 — Resolve capability + adapter

Parse the user request (and any skill args like `mailer resend`):
- **capability**: which package. If ambiguous, list the capabilities above and ask.
- **adapter**: which provider. If not stated, read `defaultAdapter` from the
  manifest and tell the user you're using it (they can override).

```bash
cat "$STACK/packages/<capability>/capability.json"
```

The manifest shape:
```json
{
  "name": "mailer",
  "defaultAdapter": "resend",
  "adapters": {
    "resend": { "deps": ["resend"], "env": ["RESEND_API_KEY"], "files": ["src/adapters/resend"] }
  },
  "sharedDeps": ["valibot"],
  "peerDeps": ["react", "react-dom"],
  "sharedFiles": ["src/core", "src/factory.ts", "src/index.ts"]
}
```

## Step 2 — Understand the target project

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
  or a dir like `src/server/email/`, `src/server/inngest/`)? If so, STOP and ask:
  skip / replace / coexist. Never silently overwrite or duplicate.
- **SDK version**: if a dep is already installed at a different major than the
  adapter targets (e.g. `resend` v6 vs an adapter written for v4), flag it and
  align to the installed/latest version before vendoring.

## Step 3 — Vendor the code (own it, don't depend on it)

The reference packages are private. Integration **copies the source** into the
project so the project owns and can tweak it — that's the whole agnostic point.

**Destination depends on the capability's nature** (the personal layout —
`src/server/<cap>/`, `src/lib/http/`, `src/emails/`):

| Capability | Destination | Why |
|---|---|---|
| mailer, storage, jobs, cache, logger, analytics, error-tracking | `<srcRoot>/server/<capability>/` | **server-only**: uses secrets + node SDKs, must never reach the client bundle |
| email-kit | `<srcRoot>/emails/components/` | React Email templates/primitives |
| http (`apiFetch`, response helpers) | `<srcRoot>/lib/http/` | **pure**, runs client or server |

If the project already has a folder for this concern (e.g. `src/server/email/`),
vendor into / merge with it rather than creating a parallel dir — see the
collision check in Step 2.

Copy into the destination:
1. every path in `sharedFiles`
2. every path in the chosen adapter's `files`

```bash
DEST="<srcRoot>/server/<capability>"   # or lib/http, or emails/components
mkdir -p "$DEST"
# for each entry in sharedFiles + adapters.<adapter>.files:
cp -R "$STACK/packages/<capability>/<entry>" "$DEST/<entry-parent>/"
```

Do NOT copy other adapters, tests, README, tsconfig, or package.json.

**Cross-package imports**: some capabilities import another (`@alfredmouelle/http`,
`@alfredmouelle/email-kit`). Grep the copied files for `@alfredmouelle/`:
```bash
grep -rn "@alfredmouelle/" "$DEST"
```
For each referenced `@alfredmouelle/<x>`: recursively add it too (same process, into its
own destination per the table above), then rewrite the import from `@alfredmouelle/<x>`
to the project's `~/` alias path. Leave no `@alfredmouelle/*` import behind.

## Step 4 — Install dependencies (current versions)

Collect `sharedDeps` + chosen adapter `deps` (+ `peerDeps` if the project lacks
them). Before installing, confirm the **current** major via the find-docs skill /
`ctx7` when the SDK API matters (the vendored adapter targets a specific API
shape — flag any mismatch). Install with the detected package manager:

```bash
pnpm add <deps...>        # or npm install / yarn add / bun add
```

## Step 5 — Wire env

For each var in the adapter's `env` (+ a `<CAPABILITY>_PROVIDER` selector when it
helps):
- Append to `.env.example` (and `.env` / `.env.local` with empty values).
- If the project has a typed `env.ts`, add validated entries (mirror the style in
  `$STACK/apps/*-base/src/env.ts`: `optionalString`, picklist for the provider).

## Step 6 — Wire the composition root

Create or extend a single composition root (`<srcRoot>/server/services.ts` or
the project's equivalent) that imports the vendored factory/adapter and exports
the **port**. Pattern (the composition root, mirrored in `$STACK/apps/*-base`):

```ts
export const mailer = createMailer({
  from: env.EMAIL_FROM,
  adapter: env.EMAIL_PROVIDER === 'brevo'
    ? brevoAdapter({ apiKey: required(env.BREVO_API_KEY, 'BREVO_API_KEY') })
    : resendAdapter({ apiKey: required(env.RESEND_API_KEY, 'RESEND_API_KEY') }),
})
```

App code must import the **port** from here, never an adapter directly. If the
capability exposes an HTTP surface (jobs webhook, provider callbacks), mount it
with the framework shim from the capability's README (Next route handler vs
TanStack `createFileRoute`) — the base apps show it mounted in context.

## Step 7 — Verify

- Typecheck (`tsc --noEmit` or the project's script). Resolve any leftover
  `@alfredmouelle/*` import or missing dep.
- If the project runs biome/eslint, format the new files to match.
- Report to the user, concise: capability + adapter added, files vendored, deps
  installed, env vars to fill, and the one-line swap to change provider later.

## Guardrails

- Never leave a dangling `@alfredmouelle/*` import — vendor the dependency or rewrite it.
- Don't invent SDK calls; the vendored adapter is the source of truth, and verify
  the SDK's current API with find-docs when in doubt.
- Don't abstract what isn't being swapped — integrate only the requested capability.
- Match the project's existing conventions (alias, env style, formatter) over the
  reference repo's when they differ.

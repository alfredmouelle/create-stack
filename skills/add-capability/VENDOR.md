# Vendor a capability by hand

The public repo is the reference. Copy its source into the project so the
project owns it.

## 1. Get the reference

```bash
STACK=$(mktemp -d)
git clone --depth 1 --filter=blob:none --sparse \
  https://github.com/alfredmouelle/create-stack "$STACK"
git -C "$STACK" sparse-checkout set packages apps
```

`$STACK/packages/<capability>/capability.json` is the manifest. A single
manifest is also at
`https://raw.githubusercontent.com/alfredmouelle/create-stack/main/packages/<capability>/capability.json`.

**Done when:** the capability's `capability.json` is in hand.

## 2. Resolve capability + kind (+ adapter for a port)

Parse the request (and any skill args like `mailer resend`):

- **capability**: which package. If ambiguous, list `$STACK/packages` and ask.
- **kind**: from the manifest (`kind: "module"` or a port).
- **adapter** (ports only): the provider. If unstated, use `defaultAdapter` and
  tell the user. A module has none.

**Done when:** capability, kind, and (for a port) adapter are set from the manifest.

## 3. Read the target project

Detect by reading, not guessing:

- **Package manager**: lockfile (`pnpm-lock.yaml` / `package-lock.json` / `yarn.lock` / `bun.lockb`).
- **Framework**: `next` vs `@tanstack/react-start`. Read the capability README
  (and the matching `$STACK/apps/*-base` when it has an HTTP surface) before wiring.
- **Source root + alias**: whatever `tsconfig` paths already use.
- **Env style**: typed `env.ts` (`@t3-oss/env-core`) or raw `process.env`. Match it.
- **Collision**: a dep already installed, or a dir like `src/server/email/`.
  If so, stop and ask: skip / replace / coexist.
- **SDK major**: if a dep is already on a different major than the adapter
  targets, flag it and align (find-docs) before copying.

**Done when:** package manager, framework, alias, env style, and collision
choice are known.

## 4. Copy the source

Destination (merge into an existing folder for this concern if step 3 found one):

| Capability | Destination |
|---|---|
| storage, cache, logger, analytics, jobs, error-tracking | `<srcRoot>/server/<capability>/` |
| mailer | `<srcRoot>/server/email/` |
| email-ui | `<srcRoot>/emails/components/` |
| http | `<srcRoot>/lib/http/` |

Copy only the manifest paths, stripping the leading `src/`:

- **port**: `sharedFiles` + the chosen adapter's `files`
- **module**: `files`

Package sources use NodeNext `.js` specifiers. Strip the extension on the
vendored copies.

Grep the copies for `@alfredmouelle/`. For each hit, vendor that capability
into its own destination (this same process) and rewrite the import to the
project's alias. Every `@alfredmouelle/*` import becomes a project path.

**Done when:** the destination holds the manifest files, imports are
extensionless, and `grep -rn "@alfredmouelle/" "$DEST"` is empty.

## 5. Install dependencies

Port: `sharedDeps` + the adapter's `deps`. Module: `deps` +
`frameworks.<framework>.deps`. Honour `versions` pins and `peerDeps` the
project lacks. Confirm the current major with find-docs when the SDK API
matters; flag a mismatch with the vendored shape.

```bash
pnpm add <deps...>        # or npm install / yarn add / bun add
```

**Done when:** every manifest dep is in the project's package.json.

## 6. Wire env

For each var in the manifest's `env` (adapter-level for a port, top-level for
a module), plus a `<CAPABILITY>_PROVIDER` selector when it helps:

- Append to `.env.example` (and `.env` / `.env.local` with empty values).
- If the project has a typed `env.ts`, add validated entries (mirror
  `$STACK/apps/*-base/src/env.ts`).

**Done when:** every manifest env var is in `.env.example` and, if present, `env.ts`.

## 7. Wire it

**Port.** Write the destination's `index.ts` as a lazy singleton that builds
the adapter on first use and returns the port type, so the app boots without
the env vars. App code imports the port from here.

```ts
import { redisAdapter } from './adapters/redis'
import type { CachePort } from './port'

let instance: CachePort | null = null
export function getCache(): CachePort {
  if (!instance) instance = redisAdapter({ url: env.REDIS_URL })
  return instance
}
```

**Module.** Follow `$STACK/packages/<capability>/README.md`. jobs and
error-tracking call Inngest / Sentry directly.

Some wiring edits files the project owns (`MANUAL_STEPS` in the CLI). Do them,
or hand them to the user.

**Done when:** the composition root (port) or README wiring (module) is in
place, and every leftover manual step is applied or handed over.

## 8. Verify

Typecheck. Format the new files to match the project. Report: capability
(+ adapter for a port), files vendored, deps, env vars to fill, remaining
manual steps, and for a port the one-line swap to change provider later.
Then `rm -rf "$STACK"`.

**Done when:** typecheck is clean, the clone is gone, and the user has the report.

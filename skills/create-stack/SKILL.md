---
name: create-stack
description: >-
  Scaffold a brand-new project by running the published create-stack CLI
  (@alfredmouelle/create-stack): forks a base app (Next.js App Router or TanStack
  Start), optionally inside a Turborepo/Nx monorepo, then strips it to the chosen
  database, auth, tRPC, mailer and capabilities. Use when the user wants to start
  a new project/app/codebase ("nouveau projet", "crée une app", "scaffold",
  "create-stack"). To add a tool to an existing project, use add-capability instead.
---

# Create a project with create-stack

Scaffolding is delegated to the **create-stack CLI**: a deterministic, self-contained
installer. Do not fork the base apps or reproduce the wiring by hand; just run it.

## Which CLI to run — local first, online fallback

Prefer a **local checkout** so you test the latest (even uncommitted) version; fall
back to the **published package** when the checkout isn't on this machine. Define the
`cs` helper, then call `cs …` **in the same command block** (a fresh shell per bash
call doesn't keep the function):

```bash
STACK=${STACK_REPO:-/Users/alfredmouelle/Developer/create-stack}
cs() { if [ -f "$STACK/cli/index.mjs" ]; then node "$STACK/cli/index.mjs" "$@";
       else pnpm dlx @alfredmouelle/create-stack@latest "$@"; fi; }   # local wins, else online
```

Override the local path with `$STACK_REPO`. Everything below is written with `cs`.

## Gather the choices first

The CLI is interactive (it uses a TTY wizard). When **you (the agent)** run it via
bash there is no TTY, so collect the user's choices in conversation, then run it
**non-interactively with flags**. Ask only for what's ambiguous; otherwise use the
defaults below.

- **project dir**: required (positional).
- **framework**: `tanstack` (default) or `next`.
- **monorepo**: `none` (default, standalone) | `turbo` | `nx` (orchestrator for the app in `apps/web`).
- **foundations**: any of `drizzle,trpc,better-auth,data-table` (default: all).
  `trpc` and `better-auth` pull in `drizzle`; `better-auth` forces a real mailer.
- **mailer**: `resend` (default) | `brevo` | `ses` | `none` (`none` is rejected
  when `better-auth` is kept).

## Run it (non-interactive — how the agent runs it)

```bash
cs <project-dir> \
  --framework <next|tanstack> \
  --foundations <csv> \
  --mailer <resend|brevo|ses|none>
# add --monorepo turbo|nx to scaffold into a monorepo (app in apps/web)
# add --no-install to skip install+verify, or --yes for all-defaults
```

Passing any selection flag (or `--yes`) switches the CLI to non-interactive mode,
so it never blocks on a prompt.

## Or let the user run the wizard

If the user prefers the interactive wizard, have them run it themselves (a real
TTY) — in this session, the `!` prefix works. Local checkout, or online:

```
!node /Users/alfredmouelle/Developer/create-stack/cli/index.mjs my-app   # local
!pnpm dlx @alfredmouelle/create-stack@latest my-app                      # online
```

## What it does

Forks the chosen base app, strips the unselected foundations (files, deps, env,
wiring), swaps the mailer adapter, stamps identity, generates `.env` + `.env.example`,
runs `pnpm install`, verifies (typecheck + Biome), then `git init` + an initial
commit. The result is a bootable, green project.

## After scaffolding

- Fill `.env` (copied from `.env.example`), then `pnpm dev`.
- Add more capabilities (storage, jobs, cache, logger, analytics, error-tracking,
  http) with the **add-capability** skill — those are not baked into the base.

## Notes

- Online fallback: always use `@latest` (or pin a known-good version). If a stale
  `pnpm dlx` cache serves an old version, clear it: `pnpm store prune` (or pin an
  exact version to bypass the cache). The local checkout has no such caching.
- Requires Node ≥ 22, pnpm, git and rsync on PATH.
- This skill replaces the old "convention mode" (adapting an existing scaffold):
  we always start from the base app via the CLI now.

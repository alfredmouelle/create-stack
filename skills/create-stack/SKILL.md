---
name: create-stack
description: >-
  Scaffold a brand-new project on the personal reference stack by running the
  published create-stack CLI (@alfredmouelle/create-stack). Use whenever the user
  wants to start / initialise a new project, a new app, or a fresh codebase —
  Next.js App Router or TanStack Start, wired with drizzle, trpc, better-auth,
  data-table and a mailer. Triggers: "nouveau projet", "initialise un projet",
  "crée une app", "démarre un projet", "scaffold", "create-stack", "mets en place
  ma base". Always forks the base app via the CLI — it does NOT convert an
  existing scaffold. Pairs with add-capability for swappable tools added later.
---

# Create a project with create-stack

Scaffolding is delegated to the **published CLI** — a deterministic, self-contained
installer. Do not fork the base apps or reproduce the wiring by hand; just run it.

```
@alfredmouelle/create-stack   (npm, public)
```

## Gather the choices first

The CLI is interactive (it uses a TTY wizard). When **you (the agent)** run it via
bash there is no TTY, so collect the user's choices in conversation, then run it
**non-interactively with flags**. Ask only for what's ambiguous; otherwise use the
defaults below.

- **project dir** — required (positional).
- **framework** — `tanstack` (default) or `next`.
- **foundations** — any of `drizzle,trpc,better-auth,data-table` (default: all).
  `trpc` and `better-auth` pull in `drizzle`; `better-auth` forces a real mailer.
- **mailer** — `resend` (default) | `brevo` | `ses` | `none` (`none` is rejected
  when `better-auth` is kept).

## Run it (non-interactive — how the agent runs it)

```bash
pnpm dlx @alfredmouelle/create-stack@latest <project-dir> \
  --framework <next|tanstack> \
  --foundations <csv> \
  --mailer <resend|brevo|ses|none>
# add --no-install to skip install+verify, or --yes for all-defaults
```

Passing any selection flag (or `--yes`) switches the CLI to non-interactive mode,
so it never blocks on a prompt.

## Or let the user run the wizard

If the user prefers the interactive wizard, have them run it themselves (a real
TTY) — in this session, the `!` prefix works:

```
!pnpm dlx @alfredmouelle/create-stack@latest my-app
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

- Always use `@latest` (or pin a known-good version). If a stale `pnpm dlx` cache
  serves an old version, clear it: `rm -rf ~/Library/Caches/pnpm/dlx`.
- Requires Node ≥ 22, pnpm, git and rsync on PATH.
- This skill replaces the old "convention mode" (adapting an existing scaffold):
  we always start from the base app via the CLI now.

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

## Which CLI to run: installed binary, else `pnpm dlx`

Use the `create-stack` binary when it's on the PATH (globally installed, no network
round-trip), else fall back to the published package. Never a local checkout: no
machine-specific path to break when the repo moves.

```bash
cs() { if command -v create-stack >/dev/null 2>&1; then create-stack "$@";
       else pnpm dlx @alfredmouelle/create-stack@$(npm view @alfredmouelle/create-stack version) "$@"; fi; }
```

Define the `cs` helper and call `cs …` **in the same command block** (a fresh shell
per bash call doesn't keep the function). Everything below is written with `cs`.

The fallback resolves the version explicitly rather than using `@latest`: a stale
`pnpm dlx` cache silently serves an old version otherwise (observed serving 0.8.1
while latest was 0.9.0), and `pnpm dlx` has no `--force` to bypass it.

## Gather the choices first

The CLI is interactive (it uses a TTY wizard). When **you (the agent)** run it via
bash there is no TTY, so collect the user's choices in conversation, then run it
**non-interactively with flags**. Ask only for what's ambiguous; otherwise use the
defaults below.

- **project dir**: required (positional).
- **framework**: `tanstack` (default) or `next`.
- **monorepo**: `none` (default, standalone) | `turbo` | `nx` (orchestrator for the app in `apps/web`).
- **database**: `drizzle` (default) | `prisma` | `convex` | `none`. Convex is its
  own API layer, so it removes tRPC and can't back better-auth.
- **auth**: `better-auth` (default) | `clerk` | `none`. better-auth needs a
  database and a real mailer, both are re-added if you exclude them.
- **foundations**: `trpc` is the only strippable one left (default: kept). The ORM
  and auth are their own axes above.
- **mailer**: `resend` (default) | `brevo` | `ses` | `none` (`none` is upgraded to
  `resend` when `better-auth` is kept).
- **capabilities**: opt-in flags, see below. None is included by default.
- also available: `--pm <pnpm|npm|yarn|bun>` (auto-detected) and
  `--alias <prefix>` (default `~`).

## Run it (non-interactive, how the agent runs it)

```bash
cs <project-dir> \
  --framework <next|tanstack> \
  --database <drizzle|prisma|convex|none> \
  --auth <better-auth|clerk|none> \
  --foundations <csv> \
  --mailer <resend|brevo|ses|none>
# add --monorepo turbo|nx to scaffold into a monorepo (app in apps/web)
# add --no-install to skip install+verify, or --yes for all-defaults
```

Capabilities can be scaffolded in the same run. Ports take an optional adapter
(bare flag = default adapter), modules take none:

```bash
cs my-app --storage r2 --cache --logger pino --analytics posthog   # ports
cs my-app --jobs --error-tracking                                   # modules, no value
```

Passing any selection flag (or `--yes`) switches the CLI to non-interactive mode,
so it never blocks on a prompt.

## Or let the user run the wizard

If the user prefers the interactive wizard, have them run it themselves (a real
TTY). In this session, the `!` prefix works:

```
!create-stack my-app                                      # if installed
!pnpm dlx @alfredmouelle/create-stack@latest my-app       # else
```

## What it does

Forks the chosen base app, strips what you didn't keep (files, deps, env, wiring),
vendors the selected database/auth/mailer and capabilities, stamps identity,
generates `.env` + `.env.example`, installs, verifies (typecheck + Biome), then
`git init` + an initial commit. The result is a bootable, green project.

Capability vendoring follows the two kinds: a **port** (storage, cache, logger,
analytics, mailer) gets its `port.ts` + one adapter + a generated composition root
in `src/server/<cap>/index.ts`; a **module** (jobs, error-tracking) gets its
provider wiring directly, Inngest client/events/functions + the `api/inngest`
route for jobs, the Sentry init/instrumentation files for error-tracking.

## After scaffolding

- Fill `.env` (copied from `.env.example`), then `pnpm dev`.
- The run ends with any **manual steps** the CLI deliberately left to you (editing
  files the project owns), today the Sentry ones: `withSentryConfig` in
  `next.config.ts`, or `sentryTanstackStart()` last in `vite.config.ts` and the
  matching `src/client.tsx` / `src/server.ts` / `src/start.ts` edits. Apply them.
- Add more capabilities later (storage, cache, logger, analytics, mailer, jobs,
  error-tracking, email-kit, http) with the **add-capability** skill.

## Notes

- Never use `@latest` with `pnpm dlx`, its cache serves stale versions and there's
  no `--force`. Resolve the version first (`npm view … version`) as the `cs` helper
  does, or pin a known-good one.
- Requires Node ≥ 22, git and a package manager on PATH (rsync is the fast fork
  path, with a Node fallback when it's absent).
- This skill replaces the old "convention mode" (adapting an existing scaffold):
  we always start from the base app via the CLI now.

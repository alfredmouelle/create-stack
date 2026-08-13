---
name: create-stack
description: >-
  Start a new app or codebase with the published create-stack CLI. Use for
  requests such as "nouveau projet" or "scaffold". For an integration in an
  existing project, use add-capability.
---

# Scaffold with create-stack

Use the published CLI as the installer. Gather material choices, then run it
non-interactively.

## 1. Resolve the CLI

Prefer `create-stack` on PATH. Otherwise resolve the published npm version
explicitly and run it with `pnpm dlx`; `@latest` can resolve from stale cache.

```bash
cs() { if command -v create-stack >/dev/null 2>&1; then create-stack "$@";
       else pnpm dlx @alfredmouelle/create-stack@$(npm view @alfredmouelle/create-stack version) "$@"; fi; }
cs --help
```

Define `cs` and invoke it in the same shell block each time.

**Done when:** `cs --help` succeeds and supplies the current axes, accepted
values, and defaults.

## 2. Prepare the invocation

Set the target directory and its intended parent directory. Read `cs --help`,
ask only about choices that materially affect the request, and leave every
other choice at the CLI default. Map each stated preference to a current flag.

Only surface normalization when it affects a stated preference:

- Convex drops tRPC and cannot back better-auth.
- better-auth requires a database and a real mailer.

If the user explicitly wants the TTY wizard, give them
`create-stack <project-dir>` and hand over that interactive step.

**Done when:** the target directory is known, every stated preference maps to a
current flag, and every applicable compatibility adjustment is understood; or
the requested TTY command has been handed off.

## 3. Scaffold

Run from the intended parent directory. Repeat the `cs` definition from step 1
in the same shell block as one invocation:

```bash
cs <project-dir> --yes
cs <project-dir> <selection flags from cs --help>
```

Use `--yes` when CLI defaults satisfy the request. Otherwise pass only the
selection flags needed to express it.

**Done when:** the command exits 0 and its summary matches the requested stack.

## 4. Finish and hand off

Apply every printed manual file edit that is in scope. Report credentials and
other user-only values with the generated `.env` path, plus the CLI's exact next
commands so they match the selected package manager. Mention `add-capability`
only when a later integration is relevant.

**Done when:** every printed step is completed or explicitly handed off, and
the user has the exact env path, remaining values, and next commands.

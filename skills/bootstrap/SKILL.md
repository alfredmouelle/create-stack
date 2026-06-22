---
name: bootstrap
description: >-
  Cleans the boilerplate of a freshly scaffolded project and sets up the
  personal baseline: strict Biome (or ESLint+Prettier), TypeScript config, env
  validation, and folder conventions. Trigger when the user starts a new project
  and wants to "cleanup the boilerplate", "setup my linter", "mettre en place la
  base", "initialiser un nouveau projet" — typically right after create-next-app
  or the TanStack Start starter. Pairs with add-capability to then add tools
  (mailer, storage, jobs, …).
---

# Bootstrap a new project

Strips starter boilerplate and applies the personal baseline. Run this on a
fresh project, then use **add-capability** to add tools.

## Reference stack

Conventions are mirrored from `${STACK_REPO:-/Users/alfredmouelle/Developer/stack}`
(its `biome.jsonc`, `tsconfig.base.json`, `apps/with-*/src/env.ts`). Read those
as the source of truth rather than hardcoding values here:

```bash
STACK=${STACK_REPO:-/Users/alfredmouelle/Developer/stack}
cat "$STACK/biome.jsonc" "$STACK/tsconfig.base.json"
```

## Step 1 — Detect what was scaffolded

Read the project: framework (`next` vs `@tanstack/react-start`), package manager
(lockfile), TS/JS, app router vs pages, existing linter. Don't assume — inspect.

## Step 2 — Remove boilerplate

Clean the starter's demo content (keep the app bootable):
- Demo home page → minimal placeholder.
- Starter CSS cruft, demo components/assets, example API routes, `public/` demo
  SVGs, comment banners.
- Dead README marketing; replace with a short project README.
Confirm the list with the user before deleting anything you didn't create if it
looks non-trivial.

## Step 3 — Linter / formatter

Default: **Biome v2, strict** — copy `$STACK/biome.jsonc` into the project root
and adapt (`includes` ignores for `.next`/`.output`/generated route tree). Then:
```bash
pnpm add -D -E @biomejs/biome
pnpm biome check --write .
```
Remove ESLint/Prettier configs the starter added **unless** the user says they
want ESLint+Prettier — in that case set up the strictest config instead (don't
mix the two).

## Step 4 — TypeScript

Align `tsconfig.json` with `$STACK/tsconfig.base.json`'s strictness: `strict`,
`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`,
`noUnusedLocals`/`Parameters`. Keep the framework's required compiler options
(jsx, plugins, paths). Ensure the source alias `~/*` exists (always `~/*`, never
`@/*`) and points at `src/`.

## Step 5 — Typed env

Add `src/env.ts` with `@t3-oss/env-core` + valibot, modeled on
`$STACK/apps/with-*/src/env.ts` (start minimal: just `NODE_ENV`). Capabilities
added later via add-capability extend it.
```bash
pnpm add @t3-oss/env-core valibot
```

## Step 6 — Conventions + verify

- Create the baseline folders the personal pattern uses: `src/lib/` (pure
  utils), `src/server/` (server-only code + composition root, lives here later),
  `src/emails/` (email templates).
- Add a `.env.example`.
- Run typecheck + `biome check`; fix until clean.
- Report concisely what was removed, what was set up, and suggest the next step:
  "add a tool with add-capability".

## Guardrails

- Keep the app bootable at every step; don't delete what you can't identify as
  starter boilerplate.
- Respect an explicit linter choice (Biome vs ESLint+Prettier) — never both.
- Don't add capabilities here — that's add-capability's job.

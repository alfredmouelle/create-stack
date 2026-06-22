# create-stack

> `@alfredmouelle/create-stack`

Interactive, **deterministic** project installer. It forks a fully-wired base app
(**Next.js App Router** or **TanStack Start**) and strips it down to exactly the
foundations and provider you pick — Drizzle, tRPC, better-auth, data tables and a
mailer — then stamps identity, generates `.env`, initializes git and verifies the
result (typecheck + Biome).

No template guesswork: the output is a real, buildable app from day one.

## Quick start

```bash
pnpm dlx @alfredmouelle/create-stack my-app
# or, using the create-* convention:
pnpm create @alfredmouelle/stack my-app
# npm / yarn:
npm create @alfredmouelle/stack my-app
yarn create @alfredmouelle/stack my-app
```

Run with no extra flags → an **interactive wizard** asks every question. Pass any
selection flag → **non-interactive** mode (scriptable / CI).

## Requirements

- **Node** ≥ 22
- **pnpm** (the generated project is a pnpm project)
- **git** and **rsync** available on `PATH` (macOS/Linux ship both)

## Usage

```
create-stack [project] [flags]
```

`project` is the target directory (and default package name). It must be empty or
not exist yet. In non-interactive mode it is required.

### Flags

| Flag | Values | Default | Description |
| --- | --- | --- | --- |
| `--framework` | `tanstack` \| `next` | `tanstack` | Base app to fork. |
| `--foundations` | csv of `drizzle,trpc,better-auth,data-table` | all | Foundations to keep; the rest are stripped. |
| `--mailer` | `resend` \| `brevo` \| `ses` \| `none` | `resend` | Mailer provider. `none` is rejected when `better-auth` is kept. |
| `--no-install` | — | install on | Skip `pnpm install` + verification. |
| `--yes`, `-y` | — | — | Non-interactive with all defaults. |

Passing any of `--framework`, `--foundations`, `--mailer` or `--no-install`
(or `--yes`) switches the CLI to non-interactive mode; missing values fall back
to the defaults above.

### Dependency resolution

Selections are normalized for you:

- `trpc` ⇒ pulls in `drizzle`
- `better-auth` ⇒ pulls in `drizzle` **and** forces a real mailer (not `none`)

### Examples

```bash
# Full interactive wizard
pnpm dlx @alfredmouelle/create-stack my-app

# Everything, defaults (TanStack Start + all foundations + Resend), no questions
pnpm dlx @alfredmouelle/create-stack my-app --yes

# Next.js with just Drizzle + tRPC, Amazon SES mailer, don't install
pnpm dlx @alfredmouelle/create-stack api --framework next \
  --foundations drizzle,trpc --mailer ses --no-install

# Minimal: Drizzle only, no mailer
pnpm dlx @alfredmouelle/create-stack db-svc --foundations drizzle --mailer none
```

## What you get

- **Framework** — Next.js App Router *or* TanStack Start, fully wired (SSR, routing).
- **Drizzle ORM** — Postgres client, schema barrel, keyset pagination, seed harness.
- **tRPC v11** — typed API, SSR/RSC integration, health router.
- **better-auth** — email+password + verification, optional Google OAuth, session
  guards, auth UI pages.
- **Mailer** — Resend / Brevo / SES behind one port; React Email templates.
- **Data tables** — TanStack Table primitives (DataTable, InfiniteDataTable, …).
- **Baseline** — Tailwind v4 + shadcn, Geist, theme toggle, strict Biome, typed
  env (`src/env.ts`), Dockerfile, a generated `.gitignore` and `.env`/`.env.example`.

Unselected foundations are removed cleanly (files, deps, env vars and wiring),
and the project is left **bootable and green** (typecheck + Biome).

## Adding more capabilities

The base bakes in the **mailer** (chosen via `--mailer`). Other capabilities —
storage, jobs, cache, logger, analytics, error-tracking, http — are added *after*
scaffolding with the `add-capability` skill (it wires each adapter's env/config per
provider, which this CLI deliberately leaves out).

## After scaffolding

```bash
cd my-app
pnpm install            # only if you passed --no-install
cp .env.example .env    # fill in the values
pnpm dev
```

## Notes

- The published package is **self-contained**: the base apps, pattern manifests
  and mailer adapters are bundled at publish time, so `pnpm dlx` needs nothing but
  this package.
- The generated project is a fresh git repo (`git init`, files staged) — make your
  first commit when ready.

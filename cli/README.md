# create-stack

> `@alfredmouelle/create-stack`

**Alfred MOUELLE** — FullStack Developer

[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://twitter.com/kali47_)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)
[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)

---

Interactive, **deterministic** project installer. It forks a fully-wired base app
(**Next.js App Router** or **TanStack Start**) and strips it down to exactly the
foundations and provider you pick — Drizzle, tRPC, better-auth, data tables, a
mailer and optional capabilities (storage, cache, jobs, logger, analytics,
error-tracking) — then stamps identity, generates `.env`, initializes git and
verifies the result (typecheck + Biome).

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
- A package manager — **pnpm**, **npm**, **yarn** or **bun**. The generated project
  matches whichever you launch with (detected via `npm_config_user_agent`).
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
| `--storage` | `s3` \| `r2` \| `gcs` \| `local` | `s3` | Object storage capability (omit to skip). |
| `--cache` | `redis` \| `memory` | `redis` | Key/value cache capability (omit to skip). |
| `--jobs` | `inngest` \| `trigger` \| `memory` | `inngest` | Background jobs capability (omit to skip). `inngest` also scaffolds the serve route. |
| `--logger` | `pino` \| `console` | `pino` | Structured logging capability (omit to skip). |
| `--analytics` | `posthog` \| `plausible` \| `noop` | `posthog` | Product analytics capability (omit to skip). |
| `--error-tracking` | `sentry` \| `console` | `sentry` | Error reporting capability (omit to skip). |
| `--no-install` | — | install on | Skip `pnpm install` + verification. |
| `--yes`, `-y` | — | — | Non-interactive with all defaults. |

Each capability flag is optional: pass it (bare for the default adapter, or with a
value) to vendor that capability; omit it to leave it out. Passing any selection
flag — `--framework`, `--foundations`, `--mailer`, any capability, or `--no-install`
(or `--yes`) — switches the CLI to non-interactive mode; missing values fall back to
the defaults above.

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

# With capabilities: R2 storage, Redis cache, Inngest jobs, Sentry errors
pnpm dlx @alfredmouelle/create-stack my-app \
  --storage r2 --cache --jobs --error-tracking
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

## Capabilities

Beyond the **mailer** (always baked in, chosen via `--mailer`), the CLI can vendor
any of the swappable capabilities at scaffold time — pick them in the wizard or via
flags. Each is copied behind a port (into `src/server/<capability>/`) with a generated
composition root that reads typed env and constructs the adapter lazily, so the app
boots even before you fill in the keys:

| Capability | Adapters | Notes |
| --- | --- | --- |
| `storage` | s3, r2, gcs, local | `getStorage()` accessor. |
| `cache` | redis, memory | `getCache()` accessor. |
| `jobs` | inngest, trigger, memory | `inngest` also scaffolds `serve.ts` + the framework route. |
| `logger` | pino, console | `getLogger()` accessor. |
| `analytics` | posthog, plausible, noop | `plausible` vendors `~/lib/http`. |
| `error-tracking` | sentry, console | `getErrorTracking()` accessor. |

Adapter deps and env keys are wired into `package.json` and `src/env.ts` automatically;
cross-package imports (`@alfredmouelle/http`) are vendored into `src/lib/http` and
rewritten. To add a capability to an **existing** project (or swap an adapter), use the
`add-capability` skill.

## After scaffolding

```bash
cd my-app
pnpm install            # only if you passed --no-install
cp .env.example .env    # fill in the values
pnpm dev
```

## Notes

- The published package is **self-contained**: the base apps, the mailer adapters
  and every capability package (`+ http`) are bundled at publish time, so `pnpm dlx`
  needs nothing but this package.
- The generated project is a fresh git repo (`git init`, files staged) — make your
  first commit when ready.

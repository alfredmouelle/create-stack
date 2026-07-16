<h1 align="center">create-stack</h1>

<p align="center">
  Interactive, <strong>deterministic</strong>, framework-agnostic installer that
  bootstraps a real, fully-wired app for your favorite framework.
  <br>
  <sub><strong>Next.js</strong> and <strong>TanStack Start</strong> today, more frameworks on the way.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alfredmouelle/create-stack"><img src="https://img.shields.io/npm/v/@alfredmouelle/create-stack?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@alfredmouelle/create-stack"><img src="https://img.shields.io/npm/dw/@alfredmouelle/create-stack?color=cb3837" alt="npm downloads"></a>
  <img src="https://img.shields.io/npm/l/@alfredmouelle/create-stack?color=blue" alt="license">
  <img src="https://img.shields.io/node/v/@alfredmouelle/create-stack?color=339933&logo=node.js&logoColor=white" alt="node">
  <a href="https://create-stack.alfredmouelle.com"><img src="https://img.shields.io/badge/website-create--stack.alfredmouelle.com-d94f38" alt="website"></a>
</p>

<p align="center">
  <strong><a href="https://create-stack.alfredmouelle.com">Website &amp; interactive stack builder →</a></strong>
</p>

<p align="center">
  <!-- served from the npm tarball via jsDelivr so it renders identically on npm and GitHub; record with: vhs docs/demo.tape -->
  <img src="https://cdn.jsdelivr.net/npm/@alfredmouelle/create-stack/docs/demo.gif" alt="create-stack scaffolding a project and swapping an adapter" width="640">
</p>

---

Framework-agnostic by design: pick your framework, get a real app. create-stack forks a
fully-wired base app and strips it to exactly what you pick (database, tRPC, better-auth, a
mailer, optional capabilities), then stamps identity, writes `.env`, inits git and verifies
(typecheck + Biome). No template guesswork: the output is a real, buildable app from day one.
**Next.js App Router** and **TanStack Start** are supported today, with more frameworks on the way.

> **Open source (MIT).** Source and issues live at
> [github.com/alfredmouelle/create-stack](https://github.com/alfredmouelle/create-stack).

## Quick start

```bash
pnpm dlx @alfredmouelle/create-stack@latest my-app
# or the create-* convention (npm / yarn create also work):
pnpm create @alfredmouelle/stack@latest my-app
```

No flags → an **interactive wizard**. Any selection flag → **non-interactive** (CI / scriptable).

Requires **Node ≥ 22**, a package manager (**pnpm** / npm / yarn / bun, auto-detected and
used by the generated project), and **git** on `PATH`.

## Commands

```
create-stack [project] [flags]            # scaffold a new project
create-stack add [capability] [adapter]   # add a capability to the current project
create-stack component [name...]          # vendor standalone UI component(s)
```

`project` is the target dir (and default package name), must be empty or not exist.
`<command> --help` prints its flags; `--version` prints the version.

## Scaffold flags

| Flag | Values | Default | Notes |
| --- | --- | --- | --- |
| `--framework` | `tanstack` \| `next` | `tanstack` | Base app to fork. |
| `--monorepo` | `turbo` \| `nx` | standalone | Scaffold into a monorepo (app in `apps/web`) orchestrated by Turborepo or Nx. Bare `--monorepo` = turbo; omit for a standalone app. |
| `--pm` | `pnpm` \| `npm` \| `yarn` \| `bun` | auto-detected | Package manager for the generated project. |
| `--alias` | prefix, e.g. `@` \| `#` | `~` | Import alias; rewrites `<alias>/*` → `src/*` everywhere. |
| `--database` | `drizzle` \| `prisma` \| `convex` \| `none` | `drizzle` | Data layer. `prisma` = Prisma 7; `convex` = realtime db + API (replaces tRPC, Clerk/none auth only); `none` = database-less vitrine. |
| `--auth` | `better-auth` \| `clerk` \| `none` | `better-auth` | Auth provider. `clerk` is hosted (needs no db/mailer); `none` = no auth. |
| `--foundations` | csv of `trpc` | all | Foundations to keep; the rest are stripped. |
| `--mailer` | `resend` \| `brevo` \| `ses` \| `none` | `resend` | Mailer provider. |
| `--storage` | `s3` \| `r2` \| `gcs` \| `local` | `s3` | Object storage (omit to skip). |
| `--cache` | `redis` \| `upstash` \| `memory` | `redis` | Key/value cache (omit to skip). |
| `--jobs` | `inngest` \| `trigger` \| `memory` | `inngest` | Background jobs (omit to skip). |
| `--logger` | `pino` \| `console` | `pino` | Structured logging (omit to skip). |
| `--analytics` | `posthog` \| `plausible` \| `noop` | `posthog` | Product analytics (omit to skip). |
| `--error-tracking` | `sentry` \| `console` | `sentry` | Error reporting (omit to skip). |
| `--no-install` | - | install on | Skip install + verification. |
| `--yes`, `-y` | - | - | Non-interactive with all defaults. |

Capability flags are optional; pass one (bare = default adapter) to vendor it, omit to
skip. Any selection flag switches to non-interactive mode; `--pm`/`--alias` are modifiers,
not triggers. Selections are normalized: `trpc` and `better-auth` need a database (fall
back to `drizzle`) and `better-auth` forces a real mailer, while `clerk` is hosted and
frees both, so `--auth clerk --database none` is a valid authenticated vitrine. `convex`
is its own API layer, so it drops tRPC and pairs with Clerk or no auth (better-auth off).

```bash
# everything, defaults, no questions
pnpm dlx @alfredmouelle/create-stack my-app --yes

# Prisma instead of Drizzle, full stack
pnpm dlx @alfredmouelle/create-stack my-app --database prisma

# Clerk instead of better-auth
pnpm dlx @alfredmouelle/create-stack my-app --auth clerk

# Convex (realtime db + API) with Clerk auth
pnpm dlx @alfredmouelle/create-stack my-app --database convex --auth clerk

# Next.js, just tRPC, no auth, don't install
pnpm dlx @alfredmouelle/create-stack api --framework next --auth none --mailer none --no-install

# inside an Nx monorepo (app lands in apps/web)
pnpm dlx @alfredmouelle/create-stack my-app --monorepo nx

# vitrine: no database, no auth, no mailer
pnpm dlx @alfredmouelle/create-stack site --database none --auth none --foundations '' --mailer none

# with capabilities: R2 storage, Redis cache, Inngest jobs, Sentry errors
pnpm dlx @alfredmouelle/create-stack my-app --storage r2 --cache --jobs --error-tracking
```

## What you get

- **Framework**: Next.js App Router *or* TanStack Start, fully wired (SSR, routing).
- **Structure**: standalone app *or* a Turborepo/Nx monorepo (app in `apps/web`) with workspace, task caching, delegated scripts and hoisted git hooks.
- **Database**: Drizzle *or* Prisma 7 (Postgres, driver adapter, schema, seed, keyset pagination), *or* Convex (realtime db + API, subsumes tRPC), or none.
- **tRPC v11**: typed API, SSR/RSC integration, health router.
- **Auth**: better-auth (email+password + verification, Google OAuth, auth pages) *or* Clerk (hosted: provider, middleware, sign-in/up + `UserButton`), or none.
- **Mailer**: Resend / Brevo / SES behind one port; React Email templates.
- **Baseline**: Tailwind v4 + shadcn, Geist, theme toggle, strict Biome, typed `env.ts`, Dockerfile, git hooks, a GitHub Actions CI workflow (install + typecheck + Biome), generated `.gitignore` + `.env`.

Unselected pieces are removed cleanly (files, deps, env, wiring); the project is left
**bootable and green**.

## Capabilities

Swappable integrations, each copied behind a port into `src/server/<capability>/` with a
generated composition root that reads typed env and constructs the adapter lazily (so the
app boots before you fill the keys). Deps + env keys are wired into `package.json` and
`env.ts` automatically.

| Capability | Adapters |
| --- | --- |
| `storage` | s3, r2, gcs, local |
| `cache` | redis, upstash, memory |
| `jobs` | inngest, trigger, memory (`inngest` also scaffolds the serve route) |
| `logger` | pino, console |
| `analytics` | posthog, plausible, noop |
| `error-tracking` | sentry, console |

Add more later with `create-stack add` (same engine, merged incrementally). Re-adding with
a different adapter **swaps** it (`--keep` keeps both). Targets also include `mailer`,
`email-kit` (React Email primitives) and `http` (fetch helpers).

```bash
create-stack add                 # interactive picker
create-stack add storage r2      # one capability + adapter
create-stack add cache upstash   # swap redis → upstash
```

## Components

Opt-in UI kept out of the base bundle (its heavier deps too). Vendor one or several into a
generated project: files copied, deps merged, imports realigned to your alias. Existing files
are **never overwritten** (`--force` to override). The callable dialogs are built on
[react-call](https://react-call.desko.dev) and also mount their `<Root />` in your app shell
(tanstack `__root`, next root layout) automatically, so `.call()` works right after install.

| Component | Vendors | Deps |
| --- | --- | --- |
| `date-picker` | `ui/date-picker`, `ui/date-range-picker` (+ calendar, popover, lib/date) | react-day-picker, date-fns |
| `datatable` | `data-table`, `infinite-data-table`, `sortable-header`, `use-data-table` | @tanstack/react-table |
| `confirm` | `ui/confirm` (+ alert-dialog) — `await` a yes/no | react-call |
| `alert` | `ui/alert` (+ alert-dialog) — `await` an acknowledgement | react-call |
| `prompt` | `ui/prompt` (+ dialog) — `await` a text input | react-call |
| `choice` | `ui/choice` (+ dialog) — `await` a pick from a list | react-call |
| `confirm-passphrase` | `ui/confirm-passphrase` (+ dialog) — type an exact phrase to confirm | react-call |
| `confirm-otp` | `ui/confirm-otp` (+ dialog, input-otp) — verify an OTP code to confirm | react-call, input-otp |

```bash
create-stack component                 # interactive picker
create-stack component date-picker     # one component
create-stack component confirm prompt  # several at once
```

The callable dialogs are `await`-ed from anywhere; their `<Root />` is already mounted, so
there is nothing to wire:

```tsx
const ok = await Confirm.call({ title: 'Delete project?', variant: 'destructive' })
if (ok) deleteProject()

await Alert.call({ title: 'Saved', description: 'Your changes are live.' })

const name = await Prompt.call({ title: 'Rename', label: 'Name', defaultValue: 'my-app' }) // string | null

const dest = await Choice.call({
  title: 'Move to',
  options: [{ label: 'Inbox', value: 'inbox' }, { label: 'Archive', value: 'archive' }],
}) // string | null

const confirmed = await ConfirmPassphrase.call({ title: 'Delete repo?', phrase: repo.name })

// verify runs on submit; returning false keeps the dialog open with an error
const verified = await ConfirmOtp.call({ title: 'Enter code', verify: (code) => api.checkOtp(code) })
```

## After scaffolding

```bash
cd my-app
pnpm install     # only if you passed --no-install
# edit .env      # already generated with placeholders
pnpm dev
```

The generated project is a fresh git repo with an initial commit (skipped, files left
staged, if git `user.name`/`user.email` aren't set). The published package is
self-contained: `pnpm dlx` needs nothing else.

## Credits

Inspired by [create-t3-app](https://create.t3.gg) and the work of [Theo Browne](https://github.com/t3dotgg). Not affiliated with or endorsed by the T3 project.

## Author

**Alfred MOUELLE**, FullStack Developer

[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)
[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/alfredmouelle)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)

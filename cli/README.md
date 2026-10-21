<h1 align="center">create-stack</h1>

<p align="center">
  Pick a framework and the pieces your app needs. create-stack assembles them from a
  tested reference application.
  <br>
  <sub>Supports <strong>Next.js App Router</strong> and <strong>TanStack Start</strong>.</sub>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@alfredmouelle/create-stack"><img src="https://img.shields.io/npm/v/@alfredmouelle/create-stack?color=cb3837&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@alfredmouelle/create-stack"><img src="https://img.shields.io/npm/dw/@alfredmouelle/create-stack?color=cb3837" alt="npm downloads"></a>
  <img src="https://img.shields.io/npm/l/@alfredmouelle/create-stack?color=blue" alt="license">
  <img src="https://img.shields.io/node/v/@alfredmouelle/create-stack?color=339933&logo=node.js&logoColor=white" alt="node">
  <a href="https://create-stack.alfredmouelle.com"><img src="https://img.shields.io/badge/website-create--stack.alfredmouelle.com-d94f38" alt="website"></a>
</p>

<p align="center">
  <strong><a href="https://create-stack.alfredmouelle.com">Website and interactive stack builder</a></strong>
</p>

<p align="center">
  <!-- served from the npm tarball via jsDelivr so it renders identically on npm and GitHub; record with: vhs docs/demo.tape -->
  <img src="https://cdn.jsdelivr.net/npm/@alfredmouelle/create-stack/docs/demo.gif" alt="create-stack generating a project and changing an adapter" width="640">
</p>

---

Choose a framework, then select a database, tRPC, auth, mailer, formatter, linter, and
optional capabilities. create-stack copies the matching parts of the framework's reference
application, writes the project identity and `.env`, applies the strict quality profile,
installs dependencies, and runs the selected formatter, typecheck, and linter. With Git
enabled, it creates the initial commit after those checks pass.
The supported frameworks are **Next.js App Router** and **TanStack Start**.

> **Open source (MIT).** The source and issue tracker are on
> [github.com/alfredmouelle/create-stack](https://github.com/alfredmouelle/create-stack).

## Quick start

```bash
pnpm dlx @alfredmouelle/create-stack@latest my-app
# or the create-* convention (npm / yarn create also work):
pnpm create @alfredmouelle/stack@latest my-app
```

With no flags, the CLI runs **interactive creation**. Any selection flag switches to
**non-interactive** mode for CI and scripts.

Requires **Node ≥ 24.19.0**, a package manager (**pnpm** / npm / yarn / bun), and **git** on
`PATH`. The CLI detects the package manager used to run it and uses the same one in the
generated project.

## Commands

```
create-stack [project] [flags]                    # scaffold a new project
create-stack add [kind] [provider]                # add one capability or component
create-stack add --with kind[=provider] [...]     # add a validated batch
```

`project` names the target directory and becomes the default package name. It must not exist,
or it must be empty. `<command> --help` prints the command's flags, and `--version` prints
the installed version.

## Scaffold flags

| Flag | Values | Default | Notes |
| --- | --- | --- | --- |
| `--framework` | `tanstack` \| `next` | `tanstack` | Framework to generate. Its [framework support](#framework-support) decides the accepted stack options. |
| `--monorepo` | `turbo` \| `nx` | standalone | Put the app in `apps/web` inside a Turborepo or Nx monorepo. Bare `--monorepo` selects turbo; omit it for a standalone app. |
| `--pm` | `pnpm` \| `npm` \| `yarn` \| `bun` | auto-detected | Package manager for the generated project. |
| `--alias` | prefix, e.g. `@` \| `#` | `~` | Import alias. Rewrites imports matching `<alias>/*` to `src/*`. |
| `--database` | `drizzle` \| `prisma` \| `convex` \| `none` | `drizzle` | Data layer. `prisma` selects Prisma 7. `convex` provides a realtime database and API, so use Clerk or no auth. `none` omits the database. |
| `--auth` | `better-auth` \| `clerk` \| `none` | `better-auth` | Auth provider. `clerk` is hosted (needs no db/mailer); `none` = no auth. |
| `--minimal` | - | - | Start with the framework's smallest runnable project and omit data, auth, tRPC, mail, and capabilities. For Next.js and TanStack Start it is frontend-only. |
| `--trpc` / `--no-trpc` | - | recommended | Explicitly include or exclude the tRPC API axis. |
| `--no-db` | - | - | Explicitly exclude the data axis. |
| `--no-auth` | - | - | Explicitly exclude authentication. |
| `--no-mail` | - | - | Explicitly exclude transactional email. |
| `--mailer` | `resend` \| `brevo` \| `ses` \| `none` | `resend` | Mailer provider. |
| `--formatter` | `biome` \| `prettier` | `biome` | Formatter. A bare flag selects Biome. `--no-formatter` and oxfmt are rejected. |
| `--linter` | `biome` \| `oxlint` | `biome` | Linter. A bare flag selects Biome. `--no-linter` and ESLint are rejected; ESLint waits for typescript-eslint support of TypeScript 7. |
| `--storage` | `s3` \| `r2` \| `gcs` \| `local` | `r2` | Object storage (omit to skip). |
| `--cache` | `redis` \| `upstash` \| `memory` | `upstash` | Key/value cache (omit to skip). |
| `--jobs` | `inngest` | `inngest` | Background jobs (omit to skip; bare selects Inngest). |
| `--logger` | `pino` \| `console` | `pino` | Structured logging (omit to skip). |
| `--analytics` | `posthog` \| `plausible` \| `noop` | `posthog` | Product analytics (omit to skip). |
| `--errors`, `--error-tracking` | `sentry` | `sentry` | Error reporting (omit to skip; bare selects Sentry). |
| `--no-install` | - | install on | Skip dependency installation and verification. |
| `--no-git` | - | Git on | Do not initialize Git. |
| `--yes`, `-y` | - | - | Run non-interactively with the defaults. |

Capability flags are optional. Pass a bare flag to select its default or only provider. Leave
the flag out to skip it. Any stack or capability flag switches creation to non-interactive mode.

When flags omit stack choices, the CLI applies these rules:

- `--no-db` selects Clerk, keeps tRPC, and omits mail.
- If Better Auth stays selected, the CLI adds Drizzle when the database is omitted and Resend
  when the mailer is omitted.
- Explicit `--no-db` and `--no-mail` conflict with Better Auth.
- tRPC does not depend on the database or auth. Convex cannot be used with tRPC or Better Auth.
- If Convex's related choices are omitted, the CLI uses Clerk, no tRPC, and no mail.

Conflicting or repeated choices are reported before any file is written, never resolved by
precedence.

### Framework support

Each framework declares the stack options it implements and its own recommendations.
A choice outside that support is reported as a conflict before generation. It is never
replaced by another provider.

| Framework | Maturity | Stack options |
| --- | --- | --- |
| TanStack Start (`tanstack`, recommended) | stable | every database, auth, tRPC, mailer, formatter, and linter option |
| Next.js App Router (`next`) | stable | every database, auth, tRPC, mailer, formatter, and linter option |

A `preview` framework depends on prerelease upstream packages.

```bash
# accept all defaults without prompts
pnpm dlx @alfredmouelle/create-stack my-app --yes

# Convex with Clerk auth
pnpm dlx @alfredmouelle/create-stack my-app --database convex --auth clerk

# Next.js with tRPC, no data or auth, without installing dependencies
pnpm dlx @alfredmouelle/create-stack api --framework next --minimal --trpc --no-install

# Nx monorepo with the common capabilities
pnpm dlx @alfredmouelle/create-stack my-app --monorepo nx --storage --cache --jobs --errors
```

## Generated project

Depending on your selections, the generated project can include:

- Next.js App Router or TanStack Start with SSR and routing.
- A standalone app, or an app in `apps/web` inside a Turborepo or Nx monorepo with workspace task caching and Git hooks.
- Drizzle or Prisma 7 with Postgres, a driver adapter, schema, seed, keyset pagination, and a `start-database.sh` script that runs a local Postgres container through Docker or Podman. The generated `.env` already points to that database. Convex provides a realtime database and API. The database is optional.
- tRPC v11 with SSR/RSC integration and a health router.
- better-auth with email and password, verification, Google OAuth, and auth pages. Clerk provides hosted auth, middleware, sign-in and sign-up pages. Auth is optional.
- Resend, Brevo, or SES behind one mailer interface with React Email templates.
- Tailwind v4, shadcn, Instrument Sans and Commit Mono, a theme toggle, strict quality tooling, typed `env.ts`, a Dockerfile, Git hooks, GitHub Actions CI, and generated `.gitignore` and `.env`.

The CLI copies only the files, dependencies, env keys, and wiring of the parts you select, so
no generated file imports a part you left out. It then runs the selected formatter,
typecheck, and linter in the generated project.

### Quality profile

Every generated project, whatever its framework, enables `strict`,
`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`,
`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
`verbatimModuleSyntax`, `isolatedModules`, and `noUncheckedSideEffectImports`. It also ships
Git hooks for the selected tools (pre-commit formats and lints staged files; pre-push runs
typecheck and tests) and VS Code and Zed settings. A framework adds its own options and
never relaxes the profile, except through a declared exception that its tests cover.

Biome is recommended for both formatting and linting. `--formatter=prettier` ships
single quotes, no semicolons, trailing commas, width 100, and two-space indentation,
plus import and Tailwind class sorting. `--linter=oxlint` ships type-aware linting
with correctness, suspicious, pedantic, and performance categories as errors.
Its readonly-parameter rule preserves inferred callback types and permits external
library handles. The JSX runtime supplies React imports; functions allow up to
100 nonblank, noncomment lines, including JSX.

`check:write` fixes formatting and lint issues; `check` verifies both tools.
The pre-commit hook applies the selected tools to staged files. It rejects files
with both staged and unstaged changes before modifying them; stage or stash the
remaining changes, then retry. In monorepos, tool configurations and dependencies
live at the project root.
When Prettier is selected, its plugin owns Tailwind sorting and Biome's overlapping class-sorting rule is disabled.

## Capabilities

The CLI copies integrations into `src/server/<capability>/` and adds their dependencies and env
keys to `package.json` and `env.ts`. There are two forms.

**Port-based capabilities.** `port.ts` holds the interface and `adapters/<name>.ts` holds the
chosen provider. A generated composition root reads typed env and constructs the adapter when
the app needs it, so you can install the code before setting provider keys.

| Capability | Adapters |
| --- | --- |
| `storage` | s3, r2, gcs, local |
| `cache` | redis, upstash, memory |
| `logger` | pino, console |
| `analytics` | posthog, plausible, noop |
| `mailer` | resend, brevo, ses |

**Single-provider modules.** These use the listed provider directly:

| Capability | Provider | What lands |
| --- | --- | --- |
| `jobs` | Inngest | the client, an example typed event + function, and the serve route for your framework |
| `error-tracking` | Sentry | shared `init` options plus the framework wiring (`onRequestError` / global-error for Next, the Vite plugin, instrumentation files and middlewares for TanStack Start) |
| `email-ui` | n/a | React Email primitives and theme |
| `http` | n/a | typed fetch helpers |

Run `create-stack add` later to add capabilities or components. Re-adding a port with a
different adapter **swaps** it. Use `--keep-files` to keep both adapters. Re-adding a module
copies it again. Repeat `--with` to validate and apply capabilities and components together.
The CLI checks every entry before it changes project files.

```bash
create-stack add                                      # grouped interactive picker
create-stack add storage r2                           # one capability + provider
create-stack add cache upstash                        # swap Redis for Upstash
create-stack add jobs                                 # provider omitted
create-stack add --with storage=r2 --with jobs        # capability batch
create-stack add --with jobs --with component=confirm # mixed batch
```

## Components

These UI components are separate from the reference application. `create-stack add` installs their local
shadcn registry items, so the target application's `components.json` controls aliases, styles,
icons, and official primitives. Existing Create Stack files stay untouched unless you pass
`--force`; customized shadcn primitives remain untouched. The callable dialogs use
[react-call](https://react-call.desko.dev). The CLI mounts their `<Root />` in the app shell,
either TanStack `__root` or the Next.js root layout, so `.call()` works after installation.

| Component | Create Stack files | Official shadcn primitives | Direct packages |
| --- | --- | --- | --- |
| `date-picker` | `ui/date-picker`, `ui/date-range-picker`, `lib/date` | calendar, popover, button | react-day-picker@10.0.2, date-fns@4.4.0, lucide-react@1.56.0 |
| `data-table` | `data-table`, `infinite-data-table`, `sortable-header`, `use-data-table` | table, skeleton, button | @tanstack/react-table@8.21.3, lucide-react@1.56.0 |
| `confirm` | `ui/confirm`, waits for a yes/no result | alert-dialog | react-call@2.0.2 |
| `alert` | `ui/alert`, waits for confirmation | alert-dialog | react-call@2.0.2 |
| `prompt` | `ui/prompt`, waits for text input | dialog | react-call@2.0.2 |
| `choice` | `ui/choice`, waits for a selection | dialog | react-call@2.0.2 |
| `confirm-passphrase` | `ui/confirm-passphrase`, checks an exact phrase | dialog | react-call@2.0.2 |
| `confirm-otp` | `ui/confirm-otp`, checks an OTP code | dialog, input-otp | react-call@2.0.2 |

```bash
create-stack add                              # grouped capabilities + components picker
create-stack add component date-picker        # one component
create-stack add --with component=confirm \
  --with component=prompt                     # several components
```

Await the callable dialogs from anywhere. Their `<Root />` is already mounted:

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

// Returning false keeps the dialog open with an error.
const verified = await ConfirmOtp.call({ title: 'Enter code', verify: (code) => api.checkOtp(code) })
```

## After creating a project

```bash
cd my-app
pnpm install     # only if you passed --no-install
# edit .env      # placeholders are already present
pnpm dev
```

When the target is not inside an existing repository, the CLI initializes a new Git repository. It creates the first
commit only after installation and verification pass. If Git `user.name` or `user.email` is not
set, it skips that commit. `--no-install` leaves the project uncommitted because its checks did
not run. `--no-git` disables Git initialization. The published package includes everything it
needs, so `pnpm dlx` is enough.

## Credits

Inspired by [create-t3-app](https://create.t3.gg) and the work of [Theo Browne](https://github.com/t3dotgg). Not affiliated with or endorsed by the T3 project.

## Author

**Alfred MOUELLE**, full-stack developer

[![Portfolio](https://img.shields.io/static/v1?style=for-the-badge&label=&message=Portfolio&color=blue)](https://alfredmouelle.com)
[![ComeUp](https://img.shields.io/static/v1?style=for-the-badge&label=&message=ComeUp&color=yellow)](https://comeup.com/@alfredmouelle)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-0077B5?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/alfredmouelle)
[![X](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)](https://x.com/alfredmouelle)
[![Gmail](https://img.shields.io/badge/Gmail-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:alfredmouelle@gmail.com)

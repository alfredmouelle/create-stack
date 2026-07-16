# Changelog

All notable changes to `@alfredmouelle/create-stack` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Release cadence.** Consumers always run the latest via `npx` / `pnpm dlx`, so releases
are cut when there is user-facing value — a new framework/foundation/capability/adapter, a
fix to the generated output, or a wizard/UX change. Internal refactors, tests, CI and
docs-only changes accumulate under _Unreleased_ until the next meaningful release; related
commits are batched into a single tagged version rather than one tag per commit.

## [Unreleased]

## [0.9.0] - 2026-07-16

### Added

- **Callable UI components**: six opt-in dialogs installable with
  `create-stack component <name>` — `confirm`, `alert`, `prompt`, `choice`,
  `confirm-passphrase` and `confirm-otp`. Built on
  [react-call](https://react-call.desko.dev), they are `await`-able from anywhere
  (`const ok = await Confirm.call({ … })`); installing one vendors its dialog plus the
  shadcn primitives it needs (dialog / alert-dialog / input-otp) and auto-mounts its
  `<Root />` in the app shell (TanStack `__root`, Next root layout), so `.call()` works
  right after install. `create-stack component` now also accepts several names at once.
- **Selection warnings**: the scaffold now reports when a choice triggers an automatic
  adjustment (e.g. Convex removing tRPC, better-auth pulling in a database) instead of
  adjusting silently.

### Changed

- **Warm default theme**: both base apps now ship a warm-paper background with a terracotta
  accent (light + dark) and a tighter radius scale, matching the create-stack site so a
  fresh scaffold looks on-brand out of the box.

## [0.8.1] - 2026-07-10

### Changed

- **Neutral project metadata**: base-app `package.json` files no longer carry author
  fields, and the scaffolded project's description is now generic ("scaffolded with
  create-stack") rather than referencing the personal reference stack.

### Fixed

- **Prisma in a monorepo**: Prisma's engine build scripts (`prisma`, `@prisma/engines`)
  are now allowlisted in the monorepo root workspace, so `install` runs them and
  `db:migrate` / `db:studio` / `db:generate` work without a manual approve-builds step.
  Also fixes an invalid root `pnpm-workspace.yaml` (unquoted scoped keys) that aborted
  install outright.
- **Email preview**: scaffolded projects now ship `@react-email/ui`, so `email:dev`
  launches the React Email preview server directly instead of prompting to install a
  missing package on first run.
- **Monorepo fork**: the fork destination's parent directory is created before copying,
  fixing scaffolds that target `apps/web`.

## [0.8.0] - 2026-07-10

### Added

- **Monorepo scaffolding**: new `--monorepo [turbo|nx]` flag and wizard step. Instead of a
  standalone app, create-stack can place the app in `apps/web` inside a Turborepo or Nx
  monorepo. It generates the root `package.json` (scripts delegated to the orchestrator),
  `turbo.json` / `nx.json` with per-framework build outputs, the workspace config and
  native-build allowlist, a shared Biome config at the root, and hoists the app's git hooks
  to the repo root. Bare `--monorepo` uses Turborepo; omit it for a standalone app.

### Changed

- **Redesigned landing page**: freshly scaffolded projects now open on a polished hero
  ("Everything's wired. Start building.") with a terminal panel and Documentation / GitHub
  links, replacing the bare placeholder, built on the existing design system (theme-aware,
  links open in a new tab).

### Fixed

- **Package-manager-agnostic git hooks**: the generated pre-commit / pre-push hooks no
  longer assume pnpm. They run via `npx` / `npm run`, so they work on projects scaffolded
  with npm, yarn or bun, and inside a monorepo (where Biome now resolves at the repo root).
- **Clean app metadata**: base-app templates no longer carry the maintainer's author
  fields, so scaffolded projects start without stray author metadata.

## [0.7.0] - 2026-07-09

### Added

- **Auto-generated `BETTER_AUTH_SECRET`** — when better-auth is selected, a fresh random
  secret is written to `.env` (gitignored) so the app boots without a manual step;
  `.env.example` keeps the shared placeholder. Uses Node's crypto (no `openssl` needed).
- **GitHub Actions CI** — every scaffold now ships `.github/workflows/ci.yml` that runs
  install + typecheck + Biome on push to `main` and on pull requests, wired to the package
  manager you chose (pnpm / npm / yarn / bun). Mirrors the scaffold's own quality gate.
- **Convex as a database choice** — `--database convex` (and a wizard option) scaffolds a
  Convex backend instead of a SQL ORM: a committed `convex/` directory (schema, an example
  query/mutation and the generated `_generated` client), a realtime provider wired into the
  app shell, and a `convex-demo` page. Convex is the API too, so it replaces tRPC (dropped
  automatically) and its own react-query wiring. Because it isn't Postgres, it pairs with
  Clerk or no auth — better-auth is coerced off. Run `<pm> run convex` once to provision a
  deployment; keys live in `.env` (`CONVEX_DEPLOYMENT` + `{VITE_,NEXT_PUBLIC_}CONVEX_URL`).

## [0.6.0] - 2026-07-07

### Added

- **Choose your database** — new `--database` flag and wizard step: `drizzle` (default),
  `prisma`, or `none`. `prisma` scaffolds a Prisma 7 setup (the `prisma-client` generator +
  `@prisma/adapter-pg` reusing `pg`, a multi-file schema whose auth models track the auth
  choice, a `postinstall` client generation, and a seed harness); `none` produces a
  database-less vitrine. Prisma's build scripts are allowlisted so `install` stays clean on
  pnpm/bun.
- **Choose your auth provider** — new `--auth` flag and wizard step: `better-auth`
  (default), `clerk`, or `none`. `clerk` vendors the provider, middleware, sign-in / sign-up
  and a protected dashboard for both Next.js and TanStack Start. Clerk is hosted, so it needs
  neither a database nor a mailer — `--auth clerk --database none` is a valid authenticated
  vitrine.
- Generated projects now ship **git hooks** (via `.githooks`, activated safely on first
  install).

### Changed

- The ORM and auth are now their own axes, so `--foundations` covers only `trpc`. Selections
  are normalized for you: `trpc` and `better-auth` pull in a database (falling back to
  `drizzle`), `better-auth` forces a real mailer, and `clerk` frees both. Legacy
  `--foundations drizzle|prisma|better-auth` soft-maps onto the new `--database` / `--auth`
  flags.

## [0.5.0] - 2026-06-25

### Changed

- **BREAKING — `data-table` is no longer a `--foundations` value.** Date pickers and data
  tables no longer ship in the base scaffold; they are stripped from every project and
  installed on demand with `create-stack component [name]` (`--force` overwrites local
  edits). The `datatable` component also vendors a polished `useDataTable` hook
  (sorting / filtering / column visibility, opt-in `localStorage` persistence,
  `useReactTable` options passthrough).
- Lighter dev/prod runtime in generated projects: tRPC `loggerLink` logs only downstream
  errors in dev (not every op), the timing middleware's `console.log` is gated to dev so it
  no longer fires in production, and the default query `staleTime` is raised from 30s to
  60s. TanStack devtools are code-split behind a DEV-only lazy import, so they and their
  deps are dropped from production builds.

### Added

- Per-subcommand help: `add --help` and `component --help` print focused usage, while the
  global help is slimmed by collapsing the capability-adapter enumerations.

## [0.4.3] - 2026-06-23

### Added

- Configurable **import alias**: choose the `<alias>/*` prefix in the wizard or with
  `--alias` (default `~`). Rewrites sources, `tsconfig.json` paths and `components.json`;
  `create-stack add` aligns vendored files to the project's existing alias.
- Choose the **package manager** in the wizard or with `--pm` (`pnpm` / `npm` / `yarn` /
  `bun`); pre-selects the auto-detected one. The choice drives install, scripts and the
  generated workspace files.

### Changed

- Base apps: date picker / range picker now have dropdown month/year navigation and
  English labels.

### Fixed

- Generated composition roots no longer re-validate env vars that `env.ts` already marks
  required — the redundant `required()` guard is dropped in capability and mailer roots,
  with `env.ts` as the single source of truth.

## [0.4.2] - 2026-06-23

### Fixed

- README demo GIF is served via an absolute jsDelivr URL so it renders on the npm page.

## [0.4.1] - 2026-06-23

### Fixed

- Mark the CLI entry (`index.mjs`) executable so the `bin` runs after install.

### Changed

- README: npm badges, terminal demo GIF, author section.

## [0.4.0] - 2026-06-23

### Added

- `create-stack add` — vendor capabilities into an existing project behind a port.
- `add` extended to **mailer / email-kit / http**, with adapter swap and `--keep`.
- `--help` / `--version` flags and short-flag parsing.
- `cpSync` fallback when `rsync` is absent (native Windows support).

### Fixed

- Always re-format scaffold output so the initial commit is lint-clean for any selection.

## [0.3.1] - 2026-06-23

### Changed

- Drop the repository link from the published package (private repo).

## [0.3.0] - 2026-06-23

First published release.

### Added

- Interactive, deterministic scaffolder: fork a base app (Next.js / TanStack Start) and
  strip it to the selected foundations (Drizzle, tRPC, better-auth, data tables).
- Swappable **capabilities** vendored at scaffold time (storage, cache, jobs, logger,
  analytics, error-tracking) behind ports; Upstash Redis cache adapter.
- Mailer providers (Resend / Brevo / SES) and a typed env module (`src/env.ts`) that
  requires the provider/adapter keys the generated code mandates.
- Detect the launching package manager instead of assuming pnpm.
- Auto `git init` + initial commit after scaffolding.

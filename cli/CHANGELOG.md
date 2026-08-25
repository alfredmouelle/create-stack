# Changelog

All notable changes to `@alfredmouelle/create-stack` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

**Release cadence.** Consumers always run the latest version with `npx` or `pnpm dlx`,
so releases ship when they add user-facing value. That includes a new framework, stack
option, capability, adapter, generated-output fix, or wizard change. Tests, CI, internal
refactors, and documentation-only changes wait for the next release that adds product value.

## [Unreleased]

## [0.13.0] - 2026-08-25

### Added

- SQL projects using Drizzle or Prisma now include `start-database.sh`, which starts a
  local PostgreSQL container with Docker or Podman. The generated `.env` and README use
  the local connection details.

### Changed

- Generated Next.js and TanStack Start apps now use create-stack's starter branding in
  the home page, auth screens, email templates, theme, fonts, icons, and web manifest.
- Generated projects now record the create-stack CLI version in `createStackMetadata` and
  include a README with setup, local database, documentation, and deployment instructions.

## [0.12.0] - 2026-08-21

### Added

- `create-stack add` can now install validated local UI components, including
  `date-picker`, `data-table`, and callable dialog components, into generated apps.

### Changed

- **Breaking:** Creation now uses `--trpc` and `--no-trpc`, while every enrichment goes
  through `create-stack add`. The old spellings fail with a replacement message. Use
  `data-table` and `email-ui` for the renamed additions.
- tRPC is now an independent choice. You can select it without a database or auth, and
  generated Next.js and TanStack Start projects are checked across all four data and auth combinations.
- Capability selectors now follow one provider rule. Bare `--storage` uses R2, bare
  `--cache` uses Upstash, and jobs and errors accept either their bare selector or their
  explicit provider. `--errors` is the canonical spelling, with `--error-tracking` kept as an alias.
- The CLI now bundles its component registry and preserves existing shadcn UI files when
  adding components. Use `--force` when replacing a component is intentional.

### Fixed

- Fresh TanStack Start projects build in production again.

## [0.11.0] - 2026-07-23

### Added

- R2 storage now accepts `R2_JURISDICTION` with `eu` or `fedramp`, and sends restricted
  buckets to the matching endpoint. Leave it empty for a standard bucket.
- Both base apps now include the create-stack icon, a dark-mode-aware SVG, 192 and 512 PNGs,
  and a manifest that uses the generated project name.
- Both base apps now include `@total-typescript/ts-reset` for stricter types around common
  operations such as `JSON.parse` and `.filter(Boolean)`.

### Changed

- Choosing R2 now vendors a standalone adapter. Generated projects no longer include an
  unused S3 adapter alongside it.

### Fixed

- R2 presigned uploads no longer send the AWS SDK flexible checksums that R2 rejects.
- A project created from `./apps/api` now uses `api`, rather than the whole path, for its
  package name, README, and document title.
- Fresh Next.js projects now serve `/favicon.ico` correctly.

## [0.10.0] - 2026-07-20

### Changed

- **Breaking:** Capabilities now have two wiring models. Ports such as storage, cache,
  logger, analytics, and mailer keep several replaceable adapters. Modules such as jobs,
  error tracking, HTTP, and email-kit use one provider directly. The generated file layout
  follows the same distinction.
- Jobs now use Inngest directly. New projects get the client, a typed example event and
  function, and the serve route without an extra job port.
- Error tracking now uses Sentry directly. The CLI writes the framework files it owns and
  prints the steps that still need edits in files owned by the project.
- `--jobs` and `--error-tracking` are now provider-free flags. Passing an adapter name fails
  instead of being silently accepted.
- Capability packages no longer depend on `valibot`. Their local config schemas were
  redundant with the environment validation already generated for each project.

### Removed

- The `trigger` and `memory` jobs adapters and the `console` error-tracking adapter are no
  longer generated. They were not real provider swaps.

### Fixed

- Jobs now run with the Inngest v4 API. The generated code no longer calls the removed v3
  function signature or passes `signingKey` to `serve()`.
- The mailer manifest no longer installs the unused `@react-email/render` package.
- Monorepo projects now include the `packageManager` field that Turbo and Nx need to build.
- Fresh projects no longer start Sentry with a fake DSN. Sentry stays off until you configure one.
- The run summary no longer prints `jobs (null)` for a capability without an adapter.

## [0.9.0] - 2026-07-16

### Added

- `create-stack component` can install six callable UI components: `confirm`, `alert`,
  `prompt`, `choice`, `confirm-passphrase`, and `confirm-otp`. Each component includes the
  dialog and shadcn primitives it needs, and `.call()` is ready after installation.
- The scaffold now warns when a choice changes another choice, such as Convex removing tRPC
  or better-auth adding a database.

### Changed

- Both base apps now start with the warm-paper theme and terracotta accent used by the
  create-stack site, in light and dark mode.

## [0.8.1] - 2026-07-10

### Changed

- Base app metadata no longer carries author fields. Generated projects use the neutral
  description `scaffolded with create-stack`.

### Fixed

- Prisma now works in monorepos. Its engine packages are allowlisted, and the generated
  workspace configuration is valid for pnpm.
- Email preview now starts with the package it imports instead of asking for a missing package.
- Monorepo scaffolds now create the target parent directory before copying the app.

## [0.8.0] - 2026-07-10

### Added

- `--monorepo turbo` and `--monorepo nx` now place the generated app in `apps/web` with the
  workspace configuration, shared Biome setup, and root git hooks already connected.

### Changed

- Fresh projects now open with a working landing page instead of the old placeholder. The
  page includes the first app screen and links to the project documentation and GitHub.
- Generated git hooks now work with npm, yarn, bun, and pnpm, including inside a monorepo.
- Base app templates no longer carry maintainer metadata into generated projects.

## [0.7.0] - 2026-07-09

### Added

- Generated projects now include GitHub Actions CI for install, typecheck, and Biome on pull
  requests and pushes to `main`. The workflow uses the package manager selected during setup.
- Convex is now available as a database choice. It generates the schema, example query and
  mutation, client, app wiring, and a demo page. Convex replaces tRPC and does not require
  Postgres or better-auth.
- Projects using better-auth now get a random `BETTER_AUTH_SECRET` in `.env`.

## [0.6.0] - 2026-07-07

### Added

- The wizard and CLI now support Drizzle, Prisma, or no database with `--database`.
- The wizard and CLI now support better-auth, Clerk, or no auth with `--auth`.
- Generated projects now include git hooks that run after the first install.

### Changed

- Database and auth are now separate choices. tRPC and better-auth can request a database,
  while Clerk can run without one. The old `--foundations` spellings map to the new options.

## [0.5.0] - 2026-06-25

### Changed

- **Breaking:** Date pickers and data tables are no longer part of the base scaffold. Install
  them with `create-stack component [name]`; use `--force` when replacing local edits.
- Generated projects now do less work in production. Devtools are loaded only in development,
  runtime logs are quieter, and the default query cache lasts 60 seconds instead of 30.

### Added

- `add --help` and `component --help` now show focused help without the full capability list.

## [0.4.3] - 2026-06-23

### Added

- Choose the import alias with `--alias` or in the wizard. The CLI updates source files,
  TypeScript paths, and `components.json` together.
- Choose npm, yarn, pnpm, or bun with `--pm` or in the wizard. The choice controls install,
  scripts, and generated workspace files.

### Fixed

- Generated composition roots no longer validate environment variables twice. `env.ts` is
  now the single source of truth.

## [0.4.2] - 2026-06-23

### Fixed

- The README demo now uses an absolute jsDelivr URL, so it renders on npm as well as GitHub.

## [0.4.1] - 2026-06-23

### Added

- The CLI entry is executable after installation, so the package binary runs correctly.

### Changed

- The README now includes npm badges, the terminal demo, and an author section.

## [0.4.0] - 2026-06-23

### Added

- `create-stack add` can add capabilities to an existing project behind a port.
- `add` now supports mailer, email-kit, and HTTP, including adapter swaps and `--keep`.
- The CLI now supports `--help`, `--version`, short flags, and a native copy fallback for
  systems without `rsync`.

### Fixed

- Scaffold output is formatted before the initial commit, regardless of the selected stack.

## [0.3.1] - 2026-06-23

### Changed

- The published package no longer links to the private repository.

## [0.3.0] - 2026-06-23

First published release.

### Added

- An interactive, deterministic CLI that forks a Next.js or TanStack Start app and keeps the
  database, tRPC, auth, and UI pieces you select.
- Storage, cache, jobs, logger, analytics, and error-tracking capabilities that can be
  selected during scaffolding and kept behind ports.
- Resend, Brevo, and SES mailer providers, plus typed environment validation for generated apps.
- Package-manager detection for npm, yarn, pnpm, and bun.
- `git init` and an initial commit after scaffolding succeeds.

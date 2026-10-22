# Remix validation

Validated on October 22, 2026 with Node 24.19.0 and `remix@3.0.0`.
Remix remains preview. Pages use `remix/component`; transactional email rendering uses isolated React calls. Production runs the Node start script and compiles public assets at runtime, with no application build directory.

## Automated checks

The full workspace regression run passed all 18 tasks. Its CLI suite passed 1,090 tests, with 49 opt-in runtime/certification cases skipped by default and exercised separately where listed below. Root quality and type checks passed.

- Reference conformance: ownership, imports for every supported selection, and byte-identical recommended renderers across all four framework modules.
- Remix quality matrix: all four formatter/linter combinations in standalone, Turborepo, and Nx projects, including type-aware Oxlint and the complete strict TypeScript profile.
- Native component additions: all advertised components pass each formatter/linter combination with a custom alias.
- Installed Remix smoke matrix: recommended, minimal, Prisma, Convex/Clerk, capability additions and replacement, callable roots, and component compatibility.
- Package managers: pnpm, npm, Yarn, and Bun install, pass the creation gate, write their lockfiles, and serve production assets. The pnpm case also verifies automatic initial commit creation.
- Packed certification: source/packed equivalence, additions outside the repository, production HTML, fingerprinted scripts and fonts, private-file rejection, and a client-to-server import probe that returns a generic error.
- Provider runtime fixtures: Clerk verifies locally signed, concurrent request identities and rejects anonymous, expired, tampered, and unauthorized-party tokens. Clerk-only projects return 404 for the unselected Convex token endpoint, including authenticated requests. Protected native SSR compiles the Clerk browser entry without evaluating its SDK on the server. Sentry sends real SDK envelopes to a local collector. Inngest executes a signed invocation through the native HTTP route and rejects unsigned production requests.
- Marketing browser suite: 41 tests, including Remix preview selection, URL restoration, and the installable framework page. The site runs on an isolated worktree port.

Reproduction commands from the repository root:

```sh
pnpm check
pnpm typecheck
pnpm exec turbo run test --concurrency=1 -- --maxWorkers=1
RUN_SMOKE=1 SMOKE_FRAMEWORK=remix pnpm --dir cli exec vitest run test/smoke.test.ts
RUN_SMOKE=1 pnpm --dir cli exec vitest run test/remix-package-manager.test.ts test/remix-provider-runtime.test.ts
RUN_CERTIFICATION=1 pnpm --dir cli exec vitest run test/certification.test.ts -t remix
```

The serial full-suite command avoids concurrent Vitest cache cleanup and keeps generated-project checks within their time budgets. Application tests use separate migrated PostgreSQL databases. Package-manager smoke tests exercise the installed manager binaries; generated manager metadata retains the repository's exact pins.

## Browser and database checks

The native home uses the reference identity, fonts, theme tokens, layout, and copy. Sign-in, sign-up, forgot-password, reset-password, and verification screens match Next's measured card/form bounds and visible text at desktop (1728 × 987) and mobile (390 × 844) sizes. Dark home rendering, theme keyboard navigation, Escape, persistence, and system-theme handling were checked in the browser.

Native forms completed sign-up, branded verification email rendering, verification, protected dashboard rendering, sign-in, sign-out, password-reset mismatch and retry, and successful password reset. The mailer used an in-memory outbox. Pending state clears when the Remix frame reload completes. The production HTTP test rejects forwarded HTTPS origins by default, accepts same-origin forms when proxy trust is explicitly enabled, and continues rejecting cross-origin submissions.

The vanilla tRPC browser client called the native API successfully. Convex subscriptions and mutations ran against an anonymous local backend pinned to `precompiled-2026-10-10-72ce13c`. A generated Prisma adapter completed a read-only SQL query against the isolated Remix PostgreSQL database.

Native callables returned alert, confirmation, prompt, choice, passphrase, and asynchronous OTP results; OTP rejection permitted retry. Focus restoration, Escape, modal behavior, and queued concurrent calls were checked. Date selection, date-range apply/clear, table sorting, column visibility, and infinite-table load-more behavior ran in the browser. A browser exception reached the local Sentry collector through the generated browser SDK integration.

## Configuration limits

Hosted Clerk and Google login require configured provider instances and accounts. These checks establish native SDK, cookie, request, SSR, and browser boundaries; they do not certify a hosted tenant's configuration. Outbound mail delivery, cloud Inngest scheduling, and ingestion by a hosted Sentry account were not exercised. Provider delivery uses the existing repository adapters, with local transports or signed fixtures for integration validation.

For Clerk with Convex, configure a JWT template named `convex` with audience `convex`, and set `CLERK_ISSUER_URL` in the Convex deployment environment before deploying its auth configuration. Generated READMEs describe the application variables and selected package-manager commands.

Native Remix UI uses handles, client entries, and `mix`/`on` handlers. React page components require native equivalents. Sentry needs the generated Node preload; runtime compilation does not provide an automatic source-map upload pipeline. Deployment includes application source and installed production dependencies.

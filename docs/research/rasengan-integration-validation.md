# Rasengan integration validation

Validated on October 21, 2026, on macOS with Node 24.19.0, against issue #136.
The source handoff was read in place and preserved. Databases, containers, ports,
environment overrides, generated projects and mail captures belonged to this checkout.

## Pinned runtime

The integration uses `rasengan@2.0.0-beta.5`, `@rasenganjs/runtime@1.0.0-beta.5`
and its explicit peer `@rasenganjs/futon@1.0.0-beta.3`. Rasengan also installs its
own Futon version. The application-owned Node server was exercised with that dependency graph.
Maturity remains preview.

Clerk uses `@clerk/react@6.18.0` and `@clerk/backend@3.26.0`.
Sentry uses `@sentry/react@10.76.2` and `@sentry/node@10.76.2`.
Its generated build integration uses `@sentry/vite-plugin@11.8.0`.

## Executed checks

| Check | Result |
| --- | --- |
| `pnpm test` | 1,092 tests passed, all 17 Turbo tasks passed. Optional runtime, smoke and packed checks ran separately. |
| `pnpm typecheck` and `pnpm check` | Passed across the repository. |
| Framework ownership/import conformance | All 68 valid Rasengan selections passed, with recommended multi-part output matching the reference. Shared import checking remains unchanged. |
| Quality tools | All four formatter/linter pairs passed in standalone, Turborepo and Nx projects. All ten compiler flags remain enabled. |
| First-commit gate | Executable tests cover success and each failed step for all three frameworks and four tool pairs. |
| Installed Rasengan smoke | Eight workflows passed, including minimal production build, independent tRPC, Convex/Clerk, provider change, mixed additions, callable mounting and shadcn enrichment. |
| Packed CLI certification | Rasengan passed actual packing, installation, enrichment, typechecking, production build and repository/packed output equivalence. |
| Package managers | pnpm, npm, Yarn 4.18.1 and Bun installed, formatted, typechecked, built and started minimal standalone projects. Home/API requests passed and compiled server requests returned 404. |
| Existing-app additions | Executable tests cover every storage, cache, logger, analytics and mail provider, provider changes, user-file preservation, and mixed-batch rejection before mutation. |
| Prisma and alternative mailers | Generated Prisma/Better Auth with Brevo and SES passed TypeScript, Prettier, Oxlint and a production build after the separately approved shared compatibility fixes. |
| Production HTTP/auth | Real isolated PostgreSQL, signup, verification requirement, captured branded email, verification cookies, protected SSR, sign-out, password reset, old-password rejection and new-password sign-in passed. Invalid startup environment was rejected. |
| Private files and client bundles | Public assets/API responses passed; server files and traversal paths were blocked. Browser JavaScript contained neither private environment values nor database/auth implementation modules. |
| Production browser flows | Signup, resend, email verification, protected dashboard, sign-out, forgot/reset password and sign-in with the new password passed. Field errors, client navigation and persisted theme selection passed. |
| Clerk/Convex runtime | Combined production home rendered; anonymous and malformed sessions returned 401, and protected SSR redirected to sign-in. An installed Clerk project with independent tRPC passed TypeScript and Biome after the final renderer change. |
| Inngest runtime | Development HTTP discovery exposed the registered function. Production rejected unsigned requests with a configured test signing key. |
| Sentry runtime/build | Generated browser initialization captured an uncaught error into a local HTTP envelope collector. Generated Node instrumentation captured framework-caught API and SSR errors with debug IDs. Installed production builds generated hidden maps, injected client/server debug IDs and deleted maps, including without upload credentials. Map HTTP requests returned 404. Browser DSN appears in creation and addition environment files. |
| Marketing browser coverage | All 40 Chromium tests passed against a production build on this checkout's isolated port. Coverage includes Rasengan selection/URL restoration, preview labels and consecutive roadmap positions. The obsolete two-framework assertion was reproduced before being replaced with the registered framework count. |
| Docker runtime | Two generated pnpm images built and started on Linux arm64 with `node:24.19.0-alpine`, minimal without error tracking and minimal with Sentry. Home/health requests passed and compiled server requests returned 404. The Sentry image initialized the real Node SDK through its default container command. The regression failed on the old image with `instrumented: false` before the preload packaging fix. |

The gated HTTP regression can be repeated after building the reference app:

```sh
pnpm --filter @alfredmouelle/rasengan-base build
RUN_RASENGAN_RUNTIME=1 pnpm --filter @alfredmouelle/create-stack exec vitest run test/rasengan-runtime.test.ts test/rasengan-serving.test.ts
RUN_SMOKE=1 SMOKE_FRAMEWORK=rasengan pnpm --filter @alfredmouelle/create-stack exec vitest run test/smoke.test.ts
RUN_SMOKE=1 pnpm --filter @alfredmouelle/create-stack exec vitest run test/rasengan-sentry.test.ts
RUN_RASENGAN_DOCKER=1 pnpm --filter @alfredmouelle/create-stack exec vitest run test/rasengan-docker.test.ts
RUN_CERTIFICATION=1 pnpm --filter @alfredmouelle/create-stack exec vitest run test/certification.test.ts -t rasengan
```

## Measured compatibility changes

Yarn 4.6.0 failed while patching TypeScript 7. Yarn 4.18.1 passed. Native TypeScript
could not resolve Node/Vite types under Yarn PnP, so generated Rasengan projects
select the node-modules linker and pin their Yarn package-manager metadata.

Callable mounting needed the separately approved shared matcher for `</Body>`.
The homepage required route metadata, and nested auth pages required `Outlet`.
The generated Node server validates a compiled environment entry before listening.

## Limits

These checks do not establish live Google OAuth, hosted Clerk sign-in, Convex
deployment/query execution, cloud Inngest delivery, Sentry ingestion/source-map upload,
or delivery through Resend, Brevo or SES. Mail was captured at the Resend SDK HTTP boundary.
Provider credentials and the printed deployment steps remain necessary.

Sentry's Node preload needs environment values supplied before import. Framework-caught
errors logged through `console.error` are captured by the generated console integration.
Source-map upload requires `SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`
in the build environment. Live upload was not certified. Custom Rasengan configuration
needs the printed plugin integration steps when automatic insertion cannot recognize it.

Rasengan does not enforce server-only page-loader imports. Private modules belong
in API routes; loaders fetch session data over same-origin HTTP. Auth routes cover
one or two segments; additional auth plugins can require more routing.

The Node adapter does not supply a trusted client IP automatically. Configure a trusted
reverse proxy and Better Auth's IP settings for production rate limiting. Without a resolved
IP, Better Auth falls back to a shared bucket. Development showed Radix ID hydration warnings;
interactive theme and auth checks passed.

Docker runtime checks covered pnpm minimal projects with and without Sentry; other
package-manager images and non-minimal container configurations were not certified.
Manager runtime checks used standalone projects; monorepo checks covered generated
metadata and all quality profiles. The Safari extension messaging rejection was reported
only in the normal Safari profile; it was absent in the clean preview/private profile.

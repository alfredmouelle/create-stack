# with-tanstack

Reference **wiring** of every `@alfredmouelle/*` capability into a TanStack Start app.
This is not a full app — it's the composition root + the framework shims, so you
can copy the pattern into a real project.

## What to look at

- `src/env.ts` — typed env (`@t3-oss/env-core` + valibot). One `*_PROVIDER` var
  per capability, validated at boot.
- `src/server/services.ts` — **the composition root**. Picks each adapter from
  the env and exports the ports (`mailer`, `storage`, `jobs`, `cache`, `logger`,
  `analytics`, `errorTracking`). This is the only file that imports adapters.
- `src/server/email.ts` — resilient `sendEmail` wrapper (mailer + logger +
  error-tracking).
- `src/emails/welcome.tsx` — an email built with `@alfredmouelle/email-kit`.
- `src/server/notifications.tsx` — a `createServerFn` that sends it.
- `src/server/jobs.ts` — a `defineJob` example.
- `src/routes/api/inngest.ts` — the Inngest webhook mounted the TanStack way
  (`createFileRoute(...).server.handlers`).

## Swapping a provider

Change one env var (e.g. `STORAGE_PROVIDER=local` → `r2`), set that adapter's
keys, restart. No code change — call sites depend only on the ports.

## The framework boundary

Only three things are framework-specific (compare with `apps/with-next`):
server functions (`createServerFn` vs server actions), the webhook mount
(`createFileRoute` vs route handler), and reading env. Everything else — the
adapters, the ports, the email templates, the `sendEmail` wrapper — is identical.

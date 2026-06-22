# with-next

Reference **wiring** of every `@stack/*` capability into a Next.js (App Router)
app. Not a full app — the composition root + framework shims, to copy into a
real project.

## What to look at

- `src/env.ts` — typed env (`@t3-oss/env-core` + valibot). Identical to the
  TanStack app: env selection is framework-agnostic.
- `src/server/services.ts` — **the composition root**. Picks each adapter from
  the env and exports the ports. The only file that imports adapters. Byte-for-byte
  the same as the TanStack app except the Inngest app id.
- `src/server/email.ts` — resilient `sendEmail` wrapper. Identical to TanStack.
- `src/emails/welcome.tsx` — an email built with `@stack/email-kit`. Identical.
- `src/server/notifications.tsx` — a Next **server action** (`'use server'`).
- `src/app/api/inngest/route.ts` — Inngest mounted as a Next **route handler**.
- `src/app/api/webhooks/resend/route.ts` — a webhook written against
  `@stack/http`'s Web-standard `WebhookHandler`, mounted in one line.

## Swapping a provider

Change one env var (e.g. `EMAIL_PROVIDER=resend` → `brevo`), set its keys,
restart. No code change.

## The framework boundary

Diff this folder against `apps/with-tanstack`: the env, services, email wrapper
and templates are identical. Only the **shims** differ — server action vs
`createServerFn`, route handler vs `createFileRoute`. That's the whole cost of
switching frameworks.

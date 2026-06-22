# @alfredmouelle/mailer

Transactional email behind a tiny port. Bodies are **always** React Email
components — the mailer renders them to HTML + plain text before they reach the
provider, so application code never touches raw HTML.

## Usage

```ts
import { createMailer, resendAdapter } from '@alfredmouelle/mailer'
import { WelcomeEmail } from './emails/welcome'

// composition root — pick the provider here, once
export const mailer = createMailer({
  from: 'Acme <no-reply@acme.com>',
  adapter: resendAdapter({ apiKey: process.env.RESEND_API_KEY! }),
})

// anywhere in the app — depends only on the Mailer port
await mailer.send({
  to: 'user@example.com',
  subject: 'Welcome',
  react: <WelcomeEmail name="Alfred" verifyUrl="https://app.test/verify" />,
})
```

## Swapping provider

Change one line in the composition root:

```ts
import { brevoAdapter } from '@alfredmouelle/mailer'

adapter: brevoAdapter({ apiKey: process.env.BREVO_API_KEY! })
```

No call site changes — they all depend on `Mailer`, never on a provider.

## Templates & theming

Bodies are React Email components. Build them with
[`@alfredmouelle/email-kit`](../email-kit) for a swappable theme (colors / brand) and a
local preview studio (`pnpm --filter @alfredmouelle/email-kit email:dev`).

## Adding a provider

Implement `MailerAdapter` (`src/core/port.ts`): a `name` and a `send(message: RenderedMessage)`
that returns `{ id }`. The message arrives already rendered and address-normalized.
Look at `src/adapters/resend` (SDK-based) or `src/adapters/brevo` (fetch-based) as templates.

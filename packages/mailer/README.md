# @alfredmouelle/mailer

Transactional email through one port. Messages use React Email components. The
mailer renders them to HTML and plain text before sending them to a provider.

## Usage

```ts
import { createMailer, resendAdapter } from '@alfredmouelle/mailer'
import { WelcomeEmail } from './emails/welcome'

// Choose the provider in the composition root.
export const mailer = createMailer({
  from: 'Acme <no-reply@acme.com>',
  adapter: resendAdapter({ apiKey: process.env.RESEND_API_KEY! }),
})

// Application code depends only on the Mailer port.
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

Or Amazon SES (SESv2): credentials resolve from the standard AWS chain (env,
profile, IAM role) when omitted:

```ts
import { sesAdapter } from '@alfredmouelle/mailer'

adapter: sesAdapter({ region: process.env.AWS_REGION })
```

The SES adapter sends via the `SendEmail` Simple content path. Attachments need
a raw MIME message, which it does not build; passing `attachments` throws.

Call sites stay on `Mailer`.

## Templates & theming

Bodies are React Email components. Build them with
[`@alfredmouelle/email-ui`](../email-ui) for a swappable theme (colors / brand) and a
local preview studio (`pnpm --filter @alfredmouelle/email-ui email:dev`).

## Adding a provider

Implement `MailerAdapter` in `src/port.ts` with a `name` and a
`send(message: RenderedMessage)` method that returns `{ id }`. The message arrives
already rendered and address-normalized. Use `src/adapters/resend.ts` or
`src/adapters/brevo.ts` as references.

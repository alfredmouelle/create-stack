import { createServerFn } from '@tanstack/react-start'
import { WelcomeEmail } from '../emails/welcome.js'
import { sendEmail } from './email.js'

/**
 * A TanStack Start server function that sends a welcome email. Note it depends
 * only on the framework-agnostic `sendEmail` wrapper + the email template — the
 * mailer provider behind it is chosen in `services.ts`.
 */
export const sendWelcomeEmail = createServerFn({ method: 'POST' })
  .validator((data: { to: string; name: string }) => data)
  .handler(async ({ data }) => {
    await sendEmail({
      to: data.to,
      subject: 'Welcome aboard',
      react: <WelcomeEmail loginUrl="https://app.example.com/login" name={data.name} />,
      userId: data.to,
    })
    return { ok: true }
  })

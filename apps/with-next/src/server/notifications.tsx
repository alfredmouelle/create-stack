'use server'

import { WelcomeEmail } from '../emails/welcome.js'
import { sendEmail } from './email.js'

/**
 * A Next.js server action that sends a welcome email. The framework-specific bit
 * is just `'use server'` — the body (template + `sendEmail`) is identical to the
 * TanStack app's server function.
 */
export async function sendWelcomeEmail(input: { to: string; name: string }) {
  await sendEmail({
    to: input.to,
    subject: 'Welcome aboard',
    react: <WelcomeEmail loginUrl="https://app.example.com/login" name={input.name} />,
    userId: input.to,
  })
  return { ok: true }
}

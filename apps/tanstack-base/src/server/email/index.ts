import { env } from '~/env'
import { resendAdapter } from './adapters/resend'
import { createMailer } from './factory'
import type { MailAddress, Mailer } from './port'

export type EmailRecipient = MailAddress

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required to send email`)
  return value
}

let resolved: Mailer | null = null
function resolveMailer(): Mailer {
  if (!resolved) {
    resolved = createMailer({
      from: env.EMAIL_FROM,
      adapter: resendAdapter({ apiKey: required(env.RESEND_API_KEY, 'RESEND_API_KEY') }),
    })
  }
  return resolved
}

export const mailer: Mailer = {
  send: (message) => resolveMailer().send(message),
}

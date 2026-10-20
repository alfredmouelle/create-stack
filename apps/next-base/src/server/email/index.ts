import { env } from '~/env'
import { resendAdapter } from './adapters/resend'
import { createMailer } from './factory'
import type { MailAddress, Mailer } from './port'

export type EmailRecipient = MailAddress

let resolved: Mailer | null = null
function resolveMailer(): Mailer {
  resolved ??= createMailer({
    from: env.EMAIL_FROM,
    adapter: resendAdapter({ apiKey: env.RESEND_API_KEY }),
  })
  return resolved
}

export const mailer: Mailer = {
  send: (message) => resolveMailer().send(message),
}

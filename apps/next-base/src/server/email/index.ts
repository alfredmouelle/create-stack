import type { ReactElement } from 'react'
import { env } from '~/env'
import { resendAdapter } from './adapters/resend/index'
import type { MailAddress, Mailer } from './core/port'
import { createMailer } from './factory'

export type EmailRecipient = MailAddress

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required to send email`)
  return value
}

// Lazy so the app boots without RESEND_API_KEY; the adapter is built on first send.
let mailer: Mailer | null = null
function getMailer(): Mailer {
  if (!mailer) {
    mailer = createMailer({
      from: env.EMAIL_FROM,
      adapter: resendAdapter({ apiKey: required(env.RESEND_API_KEY, 'RESEND_API_KEY') }),
    })
  }
  return mailer
}

export async function sendEmail(params: {
  to: EmailRecipient
  subject: string
  template: ReactElement
}) {
  return getMailer().send({
    to: params.to,
    subject: params.subject,
    react: params.template,
  })
}

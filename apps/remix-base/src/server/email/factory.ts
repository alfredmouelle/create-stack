import type { ReactElement } from 'react'
import { render as renderReactEmail } from 'react-email'
import { normalizeAddress, normalizeRecipients } from './address'
import type { Mailer, MailerAdapter, MailRecipient, RenderedMessage } from './port'

export interface RenderedBody {
  readonly html: string
  readonly text: string
}

export type EmailRenderer = (react: ReactElement) => Promise<RenderedBody>

export const renderEmail: EmailRenderer = async (react) => {
  const [html, text] = await Promise.all([
    renderReactEmail(react),
    renderReactEmail(react, { plainText: true }),
  ])
  return { html, text }
}

export interface CreateMailerOptions {
  readonly adapter: MailerAdapter
  readonly from: MailRecipient
  readonly render?: EmailRenderer | undefined
}

export function createMailer(options: CreateMailerOptions): Mailer {
  const defaultFrom = normalizeAddress(options.from)
  const render = options.render ?? renderEmail

  return {
    async send(message) {
      const { html, text } = await render(message.react)

      const rendered: RenderedMessage = {
        to: normalizeRecipients(message.to),
        from:
          message.from !== undefined && message.from !== ''
            ? normalizeAddress(message.from)
            : defaultFrom,
        subject: message.subject,
        html,
        text,
        replyTo:
          message.replyTo !== undefined && message.replyTo !== ''
            ? normalizeAddress(message.replyTo)
            : undefined,
        cc:
          message.cc !== undefined && message.cc !== ''
            ? normalizeRecipients(message.cc)
            : undefined,
        bcc:
          message.bcc !== undefined && message.bcc !== ''
            ? normalizeRecipients(message.bcc)
            : undefined,
        headers: message.headers,
        tags: message.tags,
        attachments: message.attachments,
      }

      return options.adapter.send(rendered)
    },
  }
}

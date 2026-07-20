import type { ReactElement } from 'react'
import { render as renderReactEmail } from 'react-email'
import { normalizeAddress, normalizeRecipients } from './address.js'
import type { Mailer, MailerAdapter, MailRecipient, RenderedMessage } from './port.js'

export interface RenderedBody {
  html: string
  text: string
}

/** Turns a React Email component into HTML + plain text. */
export type EmailRenderer = (react: ReactElement) => Promise<RenderedBody>

/** Default renderer via `react-email`. */
export const renderEmail: EmailRenderer = async (react) => {
  const [html, text] = await Promise.all([
    renderReactEmail(react),
    renderReactEmail(react, { plainText: true }),
  ])
  return { html, text }
}

export interface CreateMailerOptions {
  /** Provider implementation (Resend, Brevo, …). */
  adapter: MailerAdapter
  /** Default sender when a message omits `from`. */
  from: MailRecipient
  /** Override the React Email renderer (mostly tests). */
  render?: EmailRenderer
}

/**
 * Build a {@link Mailer}. Composition root: pick the adapter here; the rest of
 * the app depends only on the `Mailer` port.
 *
 * Renders the React body to HTML + plain text, normalizes addresses, applies the
 * default sender, then hands a {@link RenderedMessage} to the adapter.
 */
export function createMailer(options: CreateMailerOptions): Mailer {
  const defaultFrom = normalizeAddress(options.from)
  const render = options.render ?? renderEmail

  return {
    async send(message) {
      const { html, text } = await render(message.react)

      const rendered: RenderedMessage = {
        to: normalizeRecipients(message.to),
        from: message.from ? normalizeAddress(message.from) : defaultFrom,
        subject: message.subject,
        html,
        text,
        replyTo: message.replyTo ? normalizeAddress(message.replyTo) : undefined,
        cc: message.cc ? normalizeRecipients(message.cc) : undefined,
        bcc: message.bcc ? normalizeRecipients(message.bcc) : undefined,
        headers: message.headers,
        tags: message.tags,
        attachments: message.attachments,
      }

      return options.adapter.send(rendered)
    },
  }
}

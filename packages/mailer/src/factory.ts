import { normalizeAddress, normalizeRecipients } from './core/address.js'
import type { Mailer, MailerAdapter, MailRecipient, RenderedMessage } from './core/port.js'
import { type EmailRenderer, renderEmail } from './core/render.js'

export interface CreateMailerOptions {
  /** The provider implementation (Resend, Brevo, …). */
  adapter: MailerAdapter
  /** Default sender used when a message omits `from`. */
  from: MailRecipient
  /** Override the React Email renderer (mostly for tests). */
  render?: EmailRenderer
}

/**
 * Build a {@link Mailer}. This is the composition root: pick the adapter here,
 * the rest of the app depends only on the `Mailer` port.
 *
 * The mailer renders the React body to HTML + plain text, normalizes every
 * address, applies the default sender, then hands a {@link RenderedMessage} to
 * the adapter.
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

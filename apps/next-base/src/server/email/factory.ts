import { normalizeAddress, normalizeRecipients } from './core/address'
import type { Mailer, MailerAdapter, MailRecipient, RenderedMessage } from './core/port'
import { type EmailRenderer, renderEmail } from './core/render'

export interface CreateMailerOptions {
  /** Provider implementation (Resend, Brevo, …). */
  adapter: MailerAdapter
  /** Default sender when a message omits `from`. */
  from: MailRecipient
  /** Override the renderer (mostly for tests). */
  render?: EmailRenderer
}

/**
 * Build a {@link Mailer}. Composition root: pick the adapter here; the rest of
 * the app depends only on the `Mailer` port. Renders the React body to
 * HTML + text, normalizes addresses, applies the default sender, then hands a
 * {@link RenderedMessage} to the adapter.
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

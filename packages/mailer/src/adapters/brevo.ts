import { BrevoClient } from '@getbrevo/brevo'
import type { MailAddress } from '../port.js'
import { type MailerAdapter, MailerError, type RenderedMessage } from '../port.js'

interface BrevoContact {
  email: string
  name?: string
}

interface BrevoSendRequest {
  sender: BrevoContact
  to: BrevoContact[]
  subject: string
  htmlContent: string
  textContent: string
  replyTo?: BrevoContact
  cc?: BrevoContact[]
  bcc?: BrevoContact[]
  headers?: Record<string, unknown>
  tags?: string[]
  attachment?: { name: string; content: string }[]
}

interface BrevoSendResponse {
  messageId?: string
  messageIds?: string[]
}

/** Structural view of the Brevo client (eases testing). */
export interface BrevoClientLike {
  transactionalEmails: {
    sendTransacEmail(request: BrevoSendRequest): Promise<BrevoSendResponse>
  }
}

export interface BrevoAdapterOptions {
  apiKey: string
  /** Inject custom/mock client. Defaults to real `BrevoClient`. */
  client?: BrevoClientLike
}

function toContact(address: MailAddress): BrevoContact {
  return { email: address.email, name: address.name }
}

function toBase64(content: Uint8Array | string): string {
  return typeof content === 'string' ? content : Buffer.from(content).toString('base64')
}

export function brevoAdapter(options: BrevoAdapterOptions): MailerAdapter {
  // Fail at construction, not on the first send().
  if (!options.apiKey) throw new MailerError('apiKey is required', { adapter: 'brevo' })
  const client: BrevoClientLike =
    options.client ?? (new BrevoClient({ apiKey: options.apiKey }) as unknown as BrevoClientLike)

  return {
    name: 'brevo',
    async send(message: RenderedMessage) {
      try {
        const response = await client.transactionalEmails.sendTransacEmail({
          sender: toContact(message.from),
          to: message.to.map(toContact),
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
          replyTo: message.replyTo ? toContact(message.replyTo) : undefined,
          cc: message.cc?.map(toContact),
          bcc: message.bcc?.map(toContact),
          headers: message.headers,
          tags: message.tags
            ? Object.entries(message.tags).map(([k, val]) => `${k}:${val}`)
            : undefined,
          attachment: message.attachments?.map((a) => ({
            name: a.filename,
            content: toBase64(a.content),
          })),
        })

        const id = response.messageId ?? response.messageIds?.[0]
        if (!id) throw new MailerError('Brevo returned no messageId', { adapter: 'brevo' })
        return { id }
      } catch (cause) {
        if (cause instanceof MailerError) throw cause
        throw new MailerError('Brevo request failed', { adapter: 'brevo', cause })
      }
    },
  }
}

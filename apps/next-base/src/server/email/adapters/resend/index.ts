import { Resend } from 'resend'
import * as v from 'valibot'
import { formatAddress } from '../../core/address'
import { type MailerAdapter, MailerError, type RenderedMessage } from '../../core/port'
import { ResendConfigSchema } from './config'

/** Minimal structural view of the Resend client we depend on (eases testing). */
export interface ResendClient {
  emails: {
    send(payload: ResendSendPayload): Promise<{
      data: { id: string } | null
      error: { message: string; name?: string } | null
    }>
  }
}

interface ResendSendPayload {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  cc?: string[]
  bcc?: string[]
  headers?: Record<string, string>
  tags?: { name: string; value: string }[]
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[]
}

export interface ResendAdapterOptions {
  apiKey: string
  /** Inject a custom/mock client. Defaults to a real `Resend` instance. */
  client?: ResendClient
}

function toAttachmentContent(content: Uint8Array | string): Buffer | string {
  return typeof content === 'string' ? content : Buffer.from(content)
}

export function resendAdapter(options: ResendAdapterOptions): MailerAdapter {
  // Validate config early so a missing key fails at construction, not at send().
  const config = v.parse(ResendConfigSchema, { apiKey: options.apiKey })
  const client: ResendClient =
    options.client ?? (new Resend(config.apiKey) as unknown as ResendClient)

  return {
    name: 'resend',
    async send(message: RenderedMessage) {
      const { data, error } = await client.emails.send({
        from: formatAddress(message.from),
        to: message.to.map(formatAddress),
        subject: message.subject,
        html: message.html,
        text: message.text,
        replyTo: message.replyTo ? formatAddress(message.replyTo) : undefined,
        cc: message.cc?.map(formatAddress),
        bcc: message.bcc?.map(formatAddress),
        headers: message.headers,
        tags: message.tags
          ? Object.entries(message.tags).map(([name, value]) => ({ name, value }))
          : undefined,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: toAttachmentContent(a.content),
          contentType: a.contentType,
        })),
      })

      if (error) throw new MailerError(error.message, { adapter: 'resend', cause: error })
      if (!data) throw new MailerError('Resend returned no data', { adapter: 'resend' })
      return { id: data.id }
    },
  }
}

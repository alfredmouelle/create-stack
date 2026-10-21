import { type CreateEmailOptions, Resend } from 'resend'
import { formatAddress } from '../address'
import { type MailAttachment, type MailerAdapter, MailerError, type RenderedMessage } from '../port'

export interface ResendClient {
  readonly emails: {
    send(payload: CreateEmailOptions): Promise<{
      readonly data: { readonly id: string } | null
      readonly error: { readonly message: string; readonly name?: string } | null
    }>
  }
}

export interface ResendAdapterOptions {
  readonly apiKey: string
  readonly client?: ResendClient | undefined
}

function toResendAttachment(attachment: MailAttachment) {
  return {
    filename: attachment.filename,
    content:
      typeof attachment.content === 'string' ? attachment.content : Buffer.from(attachment.content),
    ...(attachment.contentType === undefined ? {} : { contentType: attachment.contentType }),
  }
}

function recipientFields(message: RenderedMessage) {
  return {
    ...(message.replyTo === undefined ? {} : { replyTo: formatAddress(message.replyTo) }),
    ...(message.cc === undefined
      ? {}
      : { cc: message.cc.map((address) => formatAddress(address)) }),
    ...(message.bcc === undefined
      ? {}
      : { bcc: message.bcc.map((address) => formatAddress(address)) }),
  }
}

function metadataFields(message: RenderedMessage) {
  return {
    ...(message.headers === undefined ? {} : { headers: { ...message.headers } }),
    ...(message.tags === undefined
      ? {}
      : { tags: Object.entries(message.tags).map(([name, value]) => ({ name, value })) }),
    ...(message.attachments === undefined
      ? {}
      : { attachments: message.attachments.map(toResendAttachment) }),
  }
}

export function resendAdapter(options: ResendAdapterOptions): MailerAdapter {
  if (!options.apiKey) throw new MailerError('apiKey is required', { adapter: 'resend' })
  const client: ResendClient = options.client ?? new Resend(options.apiKey)

  return {
    name: 'resend',
    async send(message: RenderedMessage) {
      const { data, error } = await client.emails.send({
        from: formatAddress(message.from),
        to: message.to.map(formatAddress),
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...recipientFields(message),
        ...metadataFields(message),
      })

      if (error) throw new MailerError(error.message, { adapter: 'resend', cause: error })
      if (!data) throw new MailerError('Resend returned no data', { adapter: 'resend' })
      return { id: data.id }
    },
  }
}

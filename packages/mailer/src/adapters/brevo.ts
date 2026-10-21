import { BrevoClient } from '@getbrevo/brevo'
import type { MailAddress } from '../port.js'
import { type MailerAdapter, MailerError, type RenderedMessage } from '../port.js'

interface BrevoContact {
  readonly email: string
  readonly name?: string
}

type BrevoSendRequest = NonNullable<
  Parameters<BrevoClient['transactionalEmails']['sendTransacEmail']>[0]
>

interface BrevoSendResponse {
  readonly messageId?: string
  readonly messageIds?: readonly string[]
}

export interface BrevoClientLike {
  readonly transactionalEmails: {
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Brevo requires its mutable SDK request contract
    sendTransacEmail(request: BrevoSendRequest): Promise<BrevoSendResponse>
  }
}

export interface BrevoAdapterOptions {
  readonly apiKey: string
  readonly client?: BrevoClientLike | undefined
}

function toContact(address: MailAddress): BrevoContact {
  return { email: address.email, ...(address.name === undefined ? {} : { name: address.name }) }
}

function toBase64(content: Uint8Array | string): string {
  return typeof content === 'string' ? content : Buffer.from(content).toString('base64')
}

function createRequest(message: RenderedMessage): BrevoSendRequest {
  return {
    sender: toContact(message.from),
    to: message.to.map(toContact),
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
    ...(message.replyTo === undefined ? {} : { replyTo: toContact(message.replyTo) }),
    ...(message.cc === undefined ? {} : { cc: message.cc.map(toContact) }),
    ...(message.bcc === undefined ? {} : { bcc: message.bcc.map(toContact) }),
    ...(message.headers === undefined ? {} : { headers: message.headers }),
    ...(message.tags === undefined
      ? {}
      : { tags: Object.entries(message.tags).map(([key, value]) => `${key}:${value}`) }),
    ...(message.attachments === undefined
      ? {}
      : {
          attachment: message.attachments.map((attachment) => ({
            name: attachment.filename,
            content: toBase64(attachment.content),
          })),
        }),
  }
}

export function brevoAdapter(options: BrevoAdapterOptions): MailerAdapter {
  if (!options.apiKey) throw new MailerError('apiKey is required', { adapter: 'brevo' })
  const client = options.client ?? new BrevoClient({ apiKey: options.apiKey })

  return {
    name: 'brevo',
    async send(message: RenderedMessage) {
      try {
        const response = await client.transactionalEmails.sendTransacEmail(createRequest(message))

        const id = response.messageId ?? response.messageIds?.[0]
        if (id === undefined || id === '')
          throw new MailerError('Brevo returned no messageId', { adapter: 'brevo' })
        return { id }
      } catch (cause) {
        if (cause instanceof MailerError) throw cause
        throw new MailerError('Brevo request failed', { adapter: 'brevo', cause })
      }
    },
  }
}

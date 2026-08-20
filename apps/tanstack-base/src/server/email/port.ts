import type { ReactElement } from 'react'

export interface MailAddress {
  email: string
  name?: string
}

export type MailRecipient = string | MailAddress

export interface MailAttachment {
  filename: string
  content: Uint8Array | string
  contentType?: string
}

export interface MailMessage {
  to: MailRecipient | MailRecipient[]
  subject: string
  react: ReactElement
  from?: MailRecipient
  replyTo?: MailRecipient
  cc?: MailRecipient | MailRecipient[]
  bcc?: MailRecipient | MailRecipient[]
  headers?: Record<string, string>
  tags?: Record<string, string>
  attachments?: MailAttachment[]
}

export interface SentMail {
  id: string
}

export interface Mailer {
  send(message: MailMessage): Promise<SentMail>
}

export interface RenderedMessage {
  to: MailAddress[]
  from: MailAddress
  subject: string
  html: string
  text: string
  replyTo?: MailAddress
  cc?: MailAddress[]
  bcc?: MailAddress[]
  headers?: Record<string, string>
  tags?: Record<string, string>
  attachments?: MailAttachment[]
}

export interface MailerAdapter {
  readonly name: string
  send(message: RenderedMessage): Promise<SentMail>
}

export class MailerError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'MailerError'
    this.adapter = options.adapter
  }
}

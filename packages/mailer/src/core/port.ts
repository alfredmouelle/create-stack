import type { ReactElement } from 'react'

/** Structured email address. */
export interface MailAddress {
  email: string
  name?: string
}

/** Recipient as string (`"hi@acme.com"` / `"Acme <hi@acme.com>"`) or {@link MailAddress}. */
export type MailRecipient = string | MailAddress

export interface MailAttachment {
  filename: string
  /** Raw bytes or base64 string. */
  content: Uint8Array | string
  contentType?: string
}

/**
 * Message as authored by app code. Never raw HTML: the body is a React Email
 * component, rendered to HTML + plain text before reaching the adapter.
 */
export interface MailMessage {
  to: MailRecipient | MailRecipient[]
  subject: string
  /** React Email component. Rendered to HTML + plain text automatically. */
  react: ReactElement
  /** Overrides the mailer's default `from`. */
  from?: MailRecipient
  replyTo?: MailRecipient
  cc?: MailRecipient | MailRecipient[]
  bcc?: MailRecipient | MailRecipient[]
  headers?: Record<string, string>
  /** Provider-agnostic tags for analytics & filtering. */
  tags?: Record<string, string>
  attachments?: MailAttachment[]
}

export interface SentMail {
  /** Provider message id. */
  id: string
}

/** The port the app depends on. Swap provider = swap adapter in {@link createMailer}; this never changes. */
export interface Mailer {
  send(message: MailMessage): Promise<SentMail>
}

/** Shape an adapter receives: addresses normalized, body pre-rendered to `html` + `text`. */
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

/** Contract each provider implements. Intentionally tiny. */
export interface MailerAdapter {
  readonly name: string
  send(message: RenderedMessage): Promise<SentMail>
}

/** Normalized adapter error so callers never catch provider types. */
export class MailerError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'MailerError'
    this.adapter = options.adapter
  }
}

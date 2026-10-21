import type { ReactElement } from 'react'

export interface MailAddress {
  readonly email: string
  readonly name?: string | undefined
}

export type MailRecipient = string | MailAddress

export interface MailAttachment {
  readonly filename: string
  readonly content: Uint8Array | string
  readonly contentType?: string
}

export interface MailMessage {
  readonly to: MailRecipient | readonly MailRecipient[]
  readonly subject: string
  readonly react: ReactElement
  readonly from?: MailRecipient
  readonly replyTo?: MailRecipient
  readonly cc?: MailRecipient | readonly MailRecipient[]
  readonly bcc?: MailRecipient | readonly MailRecipient[]
  readonly headers?: Readonly<Record<string, string>>
  readonly tags?: Readonly<Record<string, string>>
  readonly attachments?: readonly MailAttachment[]
}

export interface SentMail {
  readonly id: string
}

export interface Mailer {
  send(message: MailMessage): Promise<SentMail>
}

export interface RenderedMessage {
  readonly to: readonly MailAddress[]
  readonly from: MailAddress
  readonly subject: string
  readonly html: string
  readonly text: string
  readonly replyTo?: MailAddress | undefined
  readonly cc?: readonly MailAddress[] | undefined
  readonly bcc?: readonly MailAddress[] | undefined
  readonly headers?: Readonly<Record<string, string>> | undefined
  readonly tags?: Readonly<Record<string, string>> | undefined
  readonly attachments?: readonly MailAttachment[] | undefined
}

export interface MailerAdapter {
  readonly name: string
  send(message: RenderedMessage): Promise<SentMail>
}

export class MailerError extends Error {
  readonly adapter: string

  constructor(message: string, options: { readonly adapter: string; readonly cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'MailerError'
    this.adapter = options.adapter
  }
}

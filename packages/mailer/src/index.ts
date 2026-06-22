export { type BrevoConfig, BrevoConfigSchema } from './adapters/brevo/config.js'
export {
  type BrevoAdapterOptions,
  type BrevoClientLike,
  brevoAdapter,
} from './adapters/brevo/index.js'
export { type ResendConfig, ResendConfigSchema } from './adapters/resend/config.js'
export {
  type ResendAdapterOptions,
  type ResendClient,
  resendAdapter,
} from './adapters/resend/index.js'
export { formatAddress, normalizeAddress, normalizeRecipients } from './core/address.js'
export type {
  MailAddress,
  MailAttachment,
  Mailer,
  MailerAdapter,
  MailMessage,
  MailRecipient,
  RenderedMessage,
  SentMail,
} from './core/port.js'
export { MailerError } from './core/port.js'
export { type EmailRenderer, type RenderedBody, renderEmail } from './core/render.js'
export { type CreateMailerOptions, createMailer } from './factory.js'

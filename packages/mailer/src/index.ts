export {
  type BrevoAdapterOptions,
  type BrevoClientLike,
  brevoAdapter,
} from './adapters/brevo.js'
export {
  type ResendAdapterOptions,
  type ResendClient,
  resendAdapter,
} from './adapters/resend.js'
export {
  type SesAdapterOptions,
  type SesClientLike,
  sesAdapter,
} from './adapters/ses.js'
export { formatAddress, normalizeAddress, normalizeRecipients } from './address.js'
export {
  type CreateMailerOptions,
  createMailer,
  type EmailRenderer,
  type RenderedBody,
  renderEmail,
} from './factory.js'
export type {
  MailAddress,
  MailAttachment,
  Mailer,
  MailerAdapter,
  MailMessage,
  MailRecipient,
  RenderedMessage,
  SentMail,
} from './port.js'
export { MailerError } from './port.js'

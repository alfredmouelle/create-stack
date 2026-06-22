import type { MailMessage, SentMail } from '@alfredmouelle/mailer'
import { errorTracking, logger, mailer } from './services.js'

interface SendEmailParams extends MailMessage {
  /** Associate the send with a user, for log correlation. */
  userId?: string | null
  /** Re-throw on failure instead of swallowing (default false). */
  throwOnError?: boolean
}

/**
 * Resilient wrapper around `mailer.send`: it renders + sends, and on failure
 * logs through `@alfredmouelle/logger` and reports to `@alfredmouelle/error-tracking` instead of
 * crashing the caller. Pass `throwOnError` for flows where delivery is critical.
 *
 * The body is a React Email component (see `@alfredmouelle/email-kit`).
 */
export async function sendEmail(params: SendEmailParams): Promise<SentMail | null> {
  const { userId, throwOnError = false, ...message } = params

  try {
    return await mailer.send(message)
  } catch (error) {
    logger.error('email send failed', { subject: message.subject, userId })
    errorTracking.captureException(error, {
      tags: { source: 'email' },
      extra: { subject: message.subject, userId },
    })
    if (throwOnError) throw error
    return null
  }
}

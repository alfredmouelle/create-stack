import { json, noContent, type WebhookHandler } from '@stack/http'
import { logger } from '../../../../server/services.js'

/**
 * A webhook handler written once against the Web standard (`@stack/http`'s
 * `WebhookHandler` = `Request -> Response`). It is framework-agnostic; mounting
 * it is the only framework-specific line. The TanStack app reuses the SAME
 * `handleResendWebhook` from a `createFileRoute` server handler.
 */
export const handleResendWebhook: WebhookHandler = async (request) => {
  const event = (await request.json().catch(() => null)) as { type?: string } | null
  if (!event?.type) return json({ error: 'invalid payload' }, { status: 400 })

  logger.info('resend webhook', { type: event.type })
  // …react to delivery / bounce / complaint events…
  return noContent()
}

// Next mount: the handler is already a (Request) => Response.
export const POST = handleResendWebhook

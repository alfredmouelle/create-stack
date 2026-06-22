/**
 * A handler written against the Web Fetch standard.
 *
 * Both Next.js (route handlers) and TanStack Start (server routes) speak
 * `Request -> Response`, so every capability that exposes an HTTP surface
 * (webhooks, callbacks) should target this type. Mounting it in a given
 * framework is then a one-line shim.
 */
export type FetchHandler = (request: Request) => Response | Promise<Response>

/**
 * A webhook handler is just a {@link FetchHandler}. The alias documents intent
 * at call sites (e.g. `resendWebhook(): WebhookHandler`).
 */
export type WebhookHandler = FetchHandler

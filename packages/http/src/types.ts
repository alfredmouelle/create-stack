/**
 * Web Fetch `Request -> Response` handler. Next.js route handlers and TanStack
 * Start server routes both speak it, so HTTP surfaces (webhooks, callbacks)
 * target this type; mounting is a one-line shim per framework.
 */
export type FetchHandler = (request: Request) => Response | Promise<Response>

/** Alias of {@link FetchHandler}; documents intent at call sites. */
export type WebhookHandler = FetchHandler

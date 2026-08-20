export type FetchHandler = (request: Request) => Response | Promise<Response>

export type WebhookHandler = FetchHandler

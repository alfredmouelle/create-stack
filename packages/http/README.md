# @alfredmouelle/http

Shared HTTP helpers for the monorepo. The package provides a typed `fetch`
wrapper and Web-standard request and response helpers for Next.js and TanStack
Start.

> Use this for APIs without an official SDK. When a provider ships an SDK, use
> that SDK instead. See `@alfredmouelle/mailer` and `@alfredmouelle/storage`.

## `apiFetch`: typed fetch wrapper

`apiFetch` builds URLs and queries, encodes JSON, applies timeouts, parses the
response, and throws typed errors for non-2xx responses.

```ts
import { apiFetch, isApiFetchError } from '@alfredmouelle/http'

const user = await apiFetch<User>('/users/me', {
  baseUrl: 'https://api.acme.com',
  query: { include: ['profile', 'roles'] }, // arrays expand, null/undefined dropped
  headers: { authorization: `Bearer ${token}` },
  timeoutMs: 5000,
})

try {
  await apiFetch('/things', { method: 'POST', body: { name: 'x' } }) // auto JSON + content-type
} catch (err) {
  if (isApiFetchError(err)) console.error(err.status, err.serverMessage)
}
```

Notable options: `method`, `baseUrl`, `query`, `body`, `headers`, `timeoutMs`,
`parseAs` (`'json' | 'text' | 'blob' | 'arrayBuffer' | 'none'`), `signal`,
`credentials`, `cache`, `init`, and `fetchImpl` (inject a fetch for tests/scoped
clients).

Errors: `ApiFetchError` (`status`, `statusText`, `url`, `serverMessage`,
`isNetworkError`, `isTimeout`) and `ApiParseError`.

## Web-standard handlers & responses

Write handlers against `Request` and `Response`, then mount them in either framework.

```ts
import { json, noContent, type WebhookHandler } from '@alfredmouelle/http'

export const handleWebhook: WebhookHandler = async (req) => {
  const event = await req.json()
  // Process the event.
  return noContent()
}

// Next:      export const POST = handleWebhook
// TanStack:  a server route calls handleWebhook(request)
```

Response helpers: `json(data, init)`, `noContent(init)`, `text(body, init)`,
`error(message, status, init)`.

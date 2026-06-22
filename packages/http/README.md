# @alfredmouelle/http

The shared HTTP foundation for the monorepo: a typed `fetch` wrapper and a set
of Web-standard helpers that both Next.js and TanStack Start understand.

> Use this for talking to APIs that have **no official SDK**. When a provider
> ships an SDK, prefer the SDK (see `@alfredmouelle/mailer`, `@alfredmouelle/storage`, …).

## `apiFetch` — typed fetch wrapper

URL/query building, JSON encoding, timeouts, content-negotiated parsing, and
rich typed errors. Non-2xx responses throw.

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

Write handlers once against `Request -> Response`; mount them in any framework.

```ts
import { json, noContent, type WebhookHandler } from '@alfredmouelle/http'

export const handleWebhook: WebhookHandler = async (req) => {
  const event = await req.json()
  // …process…
  return noContent()
}

// Next:      export const POST = handleWebhook
// TanStack:  a server route → handleWebhook(request)
```

Response helpers: `json(data, init)`, `noContent(init)`, `text(body, init)`,
`error(message, status, init)`.

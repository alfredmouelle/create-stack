/** JSON `Response` with correct content-type. */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...init.headers },
  })
}

/** `204 No Content` — canonical webhook ack. */
export function noContent(init: ResponseInit = {}): Response {
  return new Response(null, { status: 204, ...init })
}

/** Plain-text `Response`. */
export function text(body: string, init: ResponseInit = {}): Response {
  return new Response(body, {
    ...init,
    headers: { 'content-type': 'text/plain; charset=utf-8', ...init.headers },
  })
}

/** JSON error envelope. */
export function error(message: string, status = 400, init: ResponseInit = {}): Response {
  return json({ error: message }, { ...init, status })
}

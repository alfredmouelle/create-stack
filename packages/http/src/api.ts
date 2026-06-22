export type ApiFetchMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type ApiParseMode = 'json' | 'text' | 'blob' | 'arrayBuffer' | 'none'

export type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Record<string, QueryValue | QueryValue[]> | URLSearchParams

export interface ApiFetchOptions {
  method?: ApiFetchMethod
  baseUrl?: string
  query?: QueryParams
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  timeoutMs?: number
  parseAs?: ApiParseMode
  credentials?: RequestCredentials
  cache?: RequestCache
  init?: RequestInit
  /** Inject a custom fetch (mock in tests, scoped client in adapters). */
  fetchImpl?: typeof globalThis.fetch
}

export class ApiFetchError extends Error {
  readonly status: number
  readonly statusText: string
  readonly url: string
  readonly method: string
  readonly body: unknown
  readonly response?: Response

  constructor(
    message: string,
    details: {
      status: number
      statusText: string
      url: string
      method: string
      body?: unknown
      response?: Response
      cause?: unknown
    },
  ) {
    super(message, { cause: details.cause })
    this.name = 'ApiFetchError'
    this.status = details.status
    this.statusText = details.statusText
    this.url = details.url
    this.method = details.method
    this.body = details.body
    this.response = details.response
  }

  get isNetworkError(): boolean {
    return this.status === 0
  }

  get isTimeout(): boolean {
    return this.status === 408 || this.status === 504
  }

  get serverMessage(): string | undefined {
    const body = this.body
    if (typeof body === 'string') return body.trim() || undefined
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>
      for (const key of ['error', 'message', 'detail']) {
        const value = record[key]
        if (typeof value === 'string' && value.trim()) return value
      }
    }
    return undefined
  }
}

export function isApiFetchError(error: unknown): error is ApiFetchError {
  return error instanceof ApiFetchError
}

export class ApiParseError extends Error {
  readonly url: string
  readonly method: string
  readonly status: number
  readonly raw: string
  readonly response: Response

  constructor(
    message: string,
    details: {
      url: string
      method: string
      status: number
      raw: string
      response: Response
      cause?: unknown
    },
  ) {
    super(message, { cause: details.cause })
    this.name = 'ApiParseError'
    this.url = details.url
    this.method = details.method
    this.status = details.status
    this.raw = details.raw
    this.response = details.response
  }
}

export function isApiParseError(error: unknown): error is ApiParseError {
  return error instanceof ApiParseError
}

function isCancellation(error: unknown): boolean {
  return (
    error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')
  )
}

function isTimeoutAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'TimeoutError'
}

function timeoutError(
  error: unknown,
  url: string,
  method: string,
  response?: Response,
): ApiFetchError {
  return new ApiFetchError(`${method} ${url} timed out`, {
    status: 408,
    statusText: 'Request Timeout',
    url,
    method,
    response,
    cause: error,
  })
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
  )
}

function toSearchParams(query: QueryParams): URLSearchParams {
  if (query instanceof URLSearchParams) return query
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined) continue
    const values = Array.isArray(value) ? value : [value]
    for (const item of values) {
      if (item === null || item === undefined) continue
      params.append(key, String(item))
    }
  }
  return params
}

function buildUrl(
  path: string,
  baseUrl: string | undefined,
  query: QueryParams | undefined,
): string {
  const isAbsolute = /^[a-z][a-z\d+.-]*:\/\//i.test(path)
  const base = baseUrl ? baseUrl.replace(/\/+$/, '') : ''
  let url = isAbsolute || !base ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`

  if (query) {
    const qs = toSearchParams(query).toString()
    if (qs) url += `${url.includes('?') ? '&' : '?'}${qs}`
  }
  return url
}

function resolveSignal(
  signal: AbortSignal | undefined,
  timeoutMs: number | undefined,
): AbortSignal | undefined {
  if (timeoutMs === undefined) return signal
  const timeout = AbortSignal.timeout(timeoutMs)
  if (!signal) return timeout
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([signal, timeout])
  }
  return signal
}

function inferParseMode(response: Response): ApiParseMode {
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json') || contentType.includes('+json')) {
    return 'json'
  }
  if (!contentType || contentType.startsWith('text/')) return 'text'
  return 'blob'
}

async function parseResponse<T>(
  response: Response,
  parseAs: ApiParseMode | undefined,
  url: string,
  method: string,
): Promise<T> {
  if (parseAs === 'none' || response.status === 204 || response.status === 205) {
    return undefined as T
  }
  const mode = parseAs ?? inferParseMode(response)
  try {
    switch (mode) {
      case 'json': {
        const text = await response.text()
        if (!text) return undefined as T
        try {
          return JSON.parse(text) as T
        } catch (error) {
          throw new ApiParseError(`${method} ${url}: invalid JSON response`, {
            url,
            method,
            status: response.status,
            raw: text,
            response,
            cause: error,
          })
        }
      }
      case 'text':
        return (await response.text()) as T
      case 'blob':
        return (await response.blob()) as T
      case 'arrayBuffer':
        return (await response.arrayBuffer()) as T
      default:
        return undefined as T
    }
  } catch (error) {
    if (error instanceof ApiParseError) throw error
    if (isTimeoutAbort(error)) throw timeoutError(error, url, method, response)
    if (isCancellation(error)) throw error
    throw new ApiParseError(`${method} ${url}: failed to read response body`, {
      url,
      method,
      status: response.status,
      raw: '',
      response,
      cause: error,
    })
  }
}

async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text()
    if (!text) return undefined
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType.includes('json')) {
      try {
        return JSON.parse(text)
      } catch {
        return text
      }
    }
    return text
  } catch {
    return undefined
  }
}

function buildRequestHeaders(
  headers: HeadersInit | undefined,
  initHeaders: HeadersInit | undefined,
  parseAs: ApiParseMode | undefined,
): Headers {
  const requestHeaders = new Headers(initHeaders)
  if (headers) {
    new Headers(headers).forEach((value, key) => {
      requestHeaders.set(key, value)
    })
  }
  if (!requestHeaders.has('Accept') && parseAs !== 'blob' && parseAs !== 'arrayBuffer') {
    requestHeaders.set('Accept', 'application/json')
  }
  return requestHeaders
}

function buildRequestBody(
  body: unknown,
  method: ApiFetchMethod,
  requestHeaders: Headers,
): BodyInit | undefined {
  const sendsBody = body !== undefined && body !== null
  if (!sendsBody || method === 'GET' || method === 'HEAD') return undefined
  if (isRawBody(body)) return body
  if (!requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json')
  }
  return JSON.stringify(body)
}

/**
 * A thin, typed wrapper around `fetch`: URL/query building, JSON encoding,
 * timeouts, content-negotiated parsing, and rich `ApiFetchError`/`ApiParseError`
 * on failure. Non-2xx responses throw.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    baseUrl,
    query,
    body,
    headers,
    signal,
    timeoutMs,
    parseAs,
    credentials,
    cache,
    init,
    fetchImpl,
  } = options

  const doFetch = fetchImpl ?? globalThis.fetch
  const url = buildUrl(path, baseUrl, query)
  const requestHeaders = buildRequestHeaders(headers, init?.headers, parseAs)
  const requestBody = buildRequestBody(body, method, requestHeaders)

  const userSignal = signal ?? init?.signal ?? undefined
  const requestInit: RequestInit = { ...init }
  requestInit.method = method
  requestInit.headers = requestHeaders
  requestInit.signal = resolveSignal(userSignal, timeoutMs)
  if (method === 'GET' || method === 'HEAD') {
    requestInit.body = undefined
  } else if (requestBody !== undefined) {
    requestInit.body = requestBody
  }
  if (credentials !== undefined) requestInit.credentials = credentials
  if (cache !== undefined) requestInit.cache = cache

  let response: Response
  try {
    response = await doFetch(url, requestInit)
  } catch (error) {
    if (isTimeoutAbort(error)) throw timeoutError(error, url, method)
    if (isCancellation(error)) throw error
    throw new ApiFetchError(`${method} ${url} failed: network error`, {
      status: 0,
      statusText: '',
      url,
      method,
      cause: error,
    })
  }

  if (!response.ok) {
    throw new ApiFetchError(`${method} ${url} → ${response.status} ${response.statusText}`.trim(), {
      status: response.status,
      statusText: response.statusText,
      url,
      method,
      body: await parseErrorBody(response),
      response,
    })
  }

  return parseResponse<T>(response, parseAs, url, method)
}

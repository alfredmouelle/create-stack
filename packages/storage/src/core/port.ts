/** Write options. */
export interface PutOptions {
  /** MIME type stored with the object (e.g. `image/png`). */
  contentType?: string
}

/** Signed-URL options. */
export interface SignedUrlOptions {
  /** Download (`get`) or upload (`put`). */
  operation: 'get' | 'put'
  /** Validity window. Adapters apply a default. */
  expiresInSeconds?: number
  /** Constrain content type for `put` URLs. */
  contentType?: string
}

/** The port the app depends on. Swap provider = swap adapter; this never changes. */
export interface StoragePort {
  readonly name: string
  /** Write `data` at `key`, creating or overwriting. */
  put(key: string, data: Uint8Array | string, options?: PutOptions): Promise<void>
  /** Read bytes at `key`, or `null` if absent. */
  get(key: string): Promise<Uint8Array | null>
  /** Remove `key`. No-op if missing. */
  delete(key: string): Promise<void>
  /** Whether `key` exists. */
  exists(key: string): Promise<boolean>
  /** Mint a time-limited URL for `key`. */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>
}

/** Normalized adapter error so callers never catch provider types. */
export class StorageError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'StorageError'
    this.adapter = options.adapter
  }
}

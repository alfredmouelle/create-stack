/** Options for writing an object. */
export interface PutOptions {
  /** MIME type stored alongside the object (e.g. `image/png`). */
  contentType?: string
}

/** Options for minting a signed URL. */
export interface SignedUrlOptions {
  /** Whether the URL allows downloading (`get`) or uploading (`put`). */
  operation: 'get' | 'put'
  /** How long the URL stays valid. Adapters apply a sensible default. */
  expiresInSeconds?: number
  /** Constrain the content type for `put` URLs. */
  contentType?: string
}

/**
 * The port the application depends on. Swapping providers means swapping the
 * adapter; this interface never changes.
 */
export interface StoragePort {
  readonly name: string
  /** Write `data` at `key`, creating or overwriting it. */
  put(key: string, data: Uint8Array | string, options?: PutOptions): Promise<void>
  /** Read the bytes at `key`, or `null` if the object does not exist. */
  get(key: string): Promise<Uint8Array | null>
  /** Remove `key`. Deleting a missing key is a no-op. */
  delete(key: string): Promise<void>
  /** Whether an object exists at `key`. */
  exists(key: string): Promise<boolean>
  /** Mint a time-limited URL for `key`. */
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>
}

/** Normalized error thrown by adapters so callers never catch provider types. */
export class StorageError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'StorageError'
    this.adapter = options.adapter
  }
}

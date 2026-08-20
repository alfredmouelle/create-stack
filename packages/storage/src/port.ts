export interface PutOptions {
  contentType?: string
}

export interface SignedUrlOptions {
  operation: 'get' | 'put'
  expiresInSeconds?: number
  contentType?: string
}

export interface StoragePort {
  readonly name: string
  put(key: string, data: Uint8Array | string, options?: PutOptions): Promise<void>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
  exists(key: string): Promise<boolean>
  getSignedUrl(key: string, options: SignedUrlOptions): Promise<string>
}

export class StorageError extends Error {
  readonly adapter: string

  constructor(message: string, options: { adapter: string; cause?: unknown }) {
    super(message, { cause: options.cause })
    this.name = 'StorageError'
    this.adapter = options.adapter
  }
}

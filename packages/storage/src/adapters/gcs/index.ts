import { Storage } from '@google-cloud/storage'
import * as v from 'valibot'
import {
  type PutOptions,
  type SignedUrlOptions,
  StorageError,
  type StoragePort,
} from '../../core/port.js'
import { GcsConfigSchema } from './config.js'

/** Minimal structural view of a GCS file handle (eases testing). */
export interface GcsFileLike {
  save(data: Buffer | string, options?: { contentType?: string }): Promise<void>
  download(): Promise<[Buffer]>
  delete(): Promise<unknown>
  exists(): Promise<[boolean]>
  getSignedUrl(options: {
    version: 'v4'
    action: 'read' | 'write'
    expires: number
    contentType?: string
  }): Promise<[string]>
}

/** Minimal structural view of a GCS bucket handle. */
export interface GcsBucketLike {
  file(key: string): GcsFileLike
}

/** Minimal structural view of the GCS Storage client we depend on. */
export interface GcsStorageLike {
  bucket(name: string): GcsBucketLike
}

export interface GcsAdapterOptions {
  bucket: string
  projectId?: string
  /** Inject a custom/mock client. Defaults to a real `Storage` instance. */
  client?: GcsStorageLike
}

const DEFAULT_EXPIRES_IN = 900

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return (error as { code?: number }).code === 404
}

export function gcsAdapter(options: GcsAdapterOptions): StoragePort {
  // Validate config early so missing config fails at construction, not at use.
  const config = v.parse(GcsConfigSchema, {
    bucket: options.bucket,
    projectId: options.projectId,
  })

  const client: GcsStorageLike =
    options.client ?? (new Storage({ projectId: config.projectId }) as unknown as GcsStorageLike)

  const bucket = client.bucket(config.bucket)

  return {
    name: 'gcs',
    async put(key: string, data: Uint8Array | string, putOptions?: PutOptions) {
      const body = typeof data === 'string' ? data : Buffer.from(data)
      try {
        await bucket.file(key).save(body, { contentType: putOptions?.contentType })
      } catch (cause) {
        throw new StorageError('GCS put failed', { adapter: 'gcs', cause })
      }
    },
    async get(key: string) {
      try {
        const [contents] = await bucket.file(key).download()
        return new Uint8Array(contents)
      } catch (cause) {
        if (isNotFound(cause)) return null
        throw new StorageError('GCS get failed', { adapter: 'gcs', cause })
      }
    },
    async delete(key: string) {
      try {
        await bucket.file(key).delete()
      } catch (cause) {
        if (isNotFound(cause)) return
        throw new StorageError('GCS delete failed', { adapter: 'gcs', cause })
      }
    },
    async exists(key: string) {
      try {
        const [found] = await bucket.file(key).exists()
        return found
      } catch (cause) {
        throw new StorageError('GCS exists failed', { adapter: 'gcs', cause })
      }
    },
    async getSignedUrl(key: string, urlOptions: SignedUrlOptions) {
      const expiresInSeconds = urlOptions.expiresInSeconds ?? DEFAULT_EXPIRES_IN
      try {
        const [url] = await bucket.file(key).getSignedUrl({
          version: 'v4',
          action: urlOptions.operation === 'put' ? 'write' : 'read',
          expires: Date.now() + expiresInSeconds * 1000,
          contentType: urlOptions.contentType,
        })
        return url
      } catch (cause) {
        throw new StorageError('GCS getSignedUrl failed', { adapter: 'gcs', cause })
      }
    },
  }
}

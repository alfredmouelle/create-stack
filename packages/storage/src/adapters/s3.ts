import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { type PutOptions, type SignedUrlOptions, StorageError, type StoragePort } from '../port.js'

/** Structural view of the S3 client (eases testing). */
export interface S3ClientLike {
  send(command: unknown): Promise<unknown>
}

/** Presigner shape, injectable so tests never sign for real. */
export type S3Presigner = (
  client: S3ClientLike,
  command: unknown,
  options: { expiresIn: number },
) => Promise<string>

export interface S3AdapterOptions {
  bucket: string
  region: string
  accessKeyId?: string
  secretAccessKey?: string
  endpoint?: string
  /** Inject custom/mock client. Defaults to real `S3Client`. */
  client?: S3ClientLike
  /** Inject custom/mock presigner. Defaults to `@aws-sdk/s3-request-presigner`. */
  presign?: S3Presigner
}

const DEFAULT_EXPIRES_IN = 900

interface S3GetBody {
  transformToByteArray(): Promise<Uint8Array>
}

interface S3GetResult {
  // biome-ignore lint/style/useNamingConvention: mirrors the S3 SDK response shape (GetObjectCommandOutput.Body)
  Body?: S3GetBody
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'NoSuchKey' || e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404
}

export function s3Adapter(options: S3AdapterOptions): StoragePort {
  // Fail at construction, not on the first call.
  if (!options.bucket) throw new StorageError('bucket is required', { adapter: 's3' })
  if (!options.region) throw new StorageError('region is required', { adapter: 's3' })

  const client: S3ClientLike =
    options.client ??
    (new S3Client({
      region: options.region,
      endpoint: options.endpoint,
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    }) as unknown as S3ClientLike)

  const presign: S3Presigner = options.presign ?? (getSignedUrl as unknown as S3Presigner)

  return {
    name: 's3',
    async put(key: string, data: Uint8Array | string, putOptions?: PutOptions) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: options.bucket,
            Key: key,
            Body: data,
            ContentType: putOptions?.contentType,
          }),
        )
      } catch (cause) {
        throw new StorageError('S3 put failed', { adapter: 's3', cause })
      }
    },
    async get(key: string) {
      try {
        const result = (await client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: key }),
        )) as S3GetResult
        if (!result.Body) return null
        return await result.Body.transformToByteArray()
      } catch (cause) {
        if (isNotFound(cause)) return null
        throw new StorageError('S3 get failed', { adapter: 's3', cause })
      }
    },
    async delete(key: string) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }))
      } catch (cause) {
        throw new StorageError('S3 delete failed', { adapter: 's3', cause })
      }
    },
    async exists(key: string) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: options.bucket, Key: key }))
        return true
      } catch (cause) {
        if (isNotFound(cause)) return false
        throw new StorageError('S3 exists failed', { adapter: 's3', cause })
      }
    },
    async getSignedUrl(key: string, urlOptions: SignedUrlOptions) {
      const expiresIn = urlOptions.expiresInSeconds ?? DEFAULT_EXPIRES_IN
      const command =
        urlOptions.operation === 'put'
          ? new PutObjectCommand({
              Bucket: options.bucket,
              Key: key,
              ContentType: urlOptions.contentType,
            })
          : new GetObjectCommand({ Bucket: options.bucket, Key: key })
      try {
        return await presign(client, command, { expiresIn })
      } catch (cause) {
        throw new StorageError('S3 getSignedUrl failed', { adapter: 's3', cause })
      }
    },
  }
}

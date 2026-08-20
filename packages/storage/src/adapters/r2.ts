import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { type PutOptions, type SignedUrlOptions, StorageError, type StoragePort } from '../port.js'

export type R2Jurisdiction = 'eu' | 'fedramp'

export interface R2ClientLike {
  send(command: unknown): Promise<unknown>
}

export type R2Presigner = (
  client: R2ClientLike,
  command: unknown,
  options: { expiresIn: number },
) => Promise<string>

export interface R2AdapterOptions {
  bucket: string
  accountId: string
  jurisdiction?: R2Jurisdiction
  accessKeyId?: string
  secretAccessKey?: string
  client?: R2ClientLike
  presign?: R2Presigner
}

const DEFAULT_EXPIRES_IN = 900

export const r2Endpoint = (accountId: string, jurisdiction?: R2Jurisdiction): string =>
  `https://${accountId}${jurisdiction ? `.${jurisdiction}` : ''}.r2.cloudflarestorage.com`

interface R2GetBody {
  transformToByteArray(): Promise<Uint8Array>
}

interface R2GetResult {
  // biome-ignore lint/style/useNamingConvention: mirrors the S3 SDK response shape (GetObjectCommandOutput.Body)
  Body?: R2GetBody
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
  return e.name === 'NoSuchKey' || e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404
}

export function r2Adapter(options: R2AdapterOptions): StoragePort {
  if (!options.bucket) throw new StorageError('bucket is required', { adapter: 'r2' })
  if (!options.accountId) throw new StorageError('accountId is required', { adapter: 'r2' })

  const client: R2ClientLike =
    options.client ??
    (new S3Client({
      region: 'auto',
      endpoint: r2Endpoint(options.accountId, options.jurisdiction),
      requestChecksumCalculation: 'WHEN_REQUIRED',
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    }) as unknown as R2ClientLike)

  const presign: R2Presigner = options.presign ?? (getSignedUrl as unknown as R2Presigner)

  return {
    name: 'r2',
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
        throw new StorageError('R2 put failed', { adapter: 'r2', cause })
      }
    },
    async get(key: string) {
      try {
        const result = (await client.send(
          new GetObjectCommand({ Bucket: options.bucket, Key: key }),
        )) as R2GetResult
        if (!result.Body) return null
        return await result.Body.transformToByteArray()
      } catch (cause) {
        if (isNotFound(cause)) return null
        throw new StorageError('R2 get failed', { adapter: 'r2', cause })
      }
    },
    async delete(key: string) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: options.bucket, Key: key }))
      } catch (cause) {
        throw new StorageError('R2 delete failed', { adapter: 'r2', cause })
      }
    },
    async exists(key: string) {
      try {
        await client.send(new HeadObjectCommand({ Bucket: options.bucket, Key: key }))
        return true
      } catch (cause) {
        if (isNotFound(cause)) return false
        throw new StorageError('R2 exists failed', { adapter: 'r2', cause })
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
        throw new StorageError('R2 getSignedUrl failed', { adapter: 'r2', cause })
      }
    },
  }
}

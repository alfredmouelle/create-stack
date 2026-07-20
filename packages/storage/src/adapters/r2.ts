import { StorageError, type StoragePort } from '../port.js'
import { type S3ClientLike, type S3Presigner, s3Adapter } from './s3.js'

/**
 * R2 is S3-compatible: {@link s3Adapter} with R2's endpoint
 * (`https://<accountId>.r2.cloudflarestorage.com`) and `auto` region. All behavior inherited.
 */
export interface R2AdapterOptions {
  bucket: string
  /** Cloudflare account id (forms the R2 endpoint). */
  accountId: string
  accessKeyId?: string
  secretAccessKey?: string
  /** Inject custom/mock client. Defaults to real `S3Client`. */
  client?: S3ClientLike
  /** Inject custom/mock presigner. */
  presign?: S3Presigner
}

export function r2Adapter(options: R2AdapterOptions): StoragePort {
  // Fail at construction, not on the first call.
  if (!options.bucket) throw new StorageError('bucket is required', { adapter: 'r2' })
  if (!options.accountId) throw new StorageError('accountId is required', { adapter: 'r2' })

  const s3 = s3Adapter({
    bucket: options.bucket,
    region: 'auto',
    endpoint: `https://${options.accountId}.r2.cloudflarestorage.com`,
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    client: options.client,
    presign: options.presign,
  })

  return { ...s3, name: 'r2' }
}

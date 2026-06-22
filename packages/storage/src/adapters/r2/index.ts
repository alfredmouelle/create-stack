import * as v from 'valibot'
import type { StoragePort } from '../../core/port.js'
import { type S3ClientLike, type S3Presigner, s3Adapter } from '../s3/index.js'
import { R2ConfigSchema } from './config.js'

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
  const config = v.parse(R2ConfigSchema, {
    bucket: options.bucket,
    accountId: options.accountId,
  })

  const s3 = s3Adapter({
    bucket: config.bucket,
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    accessKeyId: options.accessKeyId,
    secretAccessKey: options.secretAccessKey,
    client: options.client,
    presign: options.presign,
  })

  return { ...s3, name: 'r2' }
}

import * as v from 'valibot'

export const S3ConfigSchema = v.object({
  bucket: v.pipe(v.string(), v.minLength(1, 'S3_BUCKET is required')),
  region: v.pipe(v.string(), v.minLength(1, 'S3_REGION is required')),
  accessKeyId: v.optional(v.string()),
  secretAccessKey: v.optional(v.string()),
  endpoint: v.optional(v.string()),
})

export type S3Config = v.InferOutput<typeof S3ConfigSchema>

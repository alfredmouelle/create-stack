import * as v from 'valibot'

export const GcsConfigSchema = v.object({
  bucket: v.pipe(v.string(), v.minLength(1, 'GCS_BUCKET is required')),
  projectId: v.optional(v.string()),
})

export type GcsConfig = v.InferOutput<typeof GcsConfigSchema>

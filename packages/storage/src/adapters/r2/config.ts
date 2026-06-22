import * as v from 'valibot'

export const R2ConfigSchema = v.object({
  bucket: v.pipe(v.string(), v.minLength(1, 'R2_BUCKET is required')),
  accountId: v.pipe(v.string(), v.minLength(1, 'R2_ACCOUNT_ID is required')),
})

export type R2Config = v.InferOutput<typeof R2ConfigSchema>

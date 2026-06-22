import * as v from 'valibot'

export const LocalConfigSchema = v.object({
  baseDir: v.pipe(v.string(), v.minLength(1, 'STORAGE_LOCAL_DIR is required')),
  publicBaseUrl: v.optional(v.string()),
})

export type LocalConfig = v.InferOutput<typeof LocalConfigSchema>

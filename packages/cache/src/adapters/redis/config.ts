import * as v from 'valibot'

export const RedisConfigSchema = v.object({
  url: v.optional(v.string()),
  keyPrefix: v.optional(v.string()),
})

export type RedisConfig = v.InferOutput<typeof RedisConfigSchema>

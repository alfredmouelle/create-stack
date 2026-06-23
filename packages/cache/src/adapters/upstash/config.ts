import * as v from 'valibot'

export const UpstashConfigSchema = v.object({
  url: v.optional(v.string()),
  token: v.optional(v.string()),
  keyPrefix: v.optional(v.string()),
})

export type UpstashConfig = v.InferOutput<typeof UpstashConfigSchema>

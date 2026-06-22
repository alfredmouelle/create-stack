import * as v from 'valibot'

export const TriggerDevConfigSchema = v.object({
  /** Secret key for authenticating triggers. Falls back to `TRIGGER_SECRET_KEY`. */
  secretKey: v.optional(v.string()),
})

export type TriggerDevConfig = v.InferOutput<typeof TriggerDevConfigSchema>

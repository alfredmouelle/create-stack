import * as v from 'valibot'

export const ResendConfigSchema = v.object({
  apiKey: v.pipe(v.string(), v.minLength(1, 'RESEND_API_KEY is required')),
})

export type ResendConfig = v.InferOutput<typeof ResendConfigSchema>

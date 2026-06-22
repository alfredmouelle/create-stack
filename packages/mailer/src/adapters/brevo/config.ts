import * as v from 'valibot'

export const BrevoConfigSchema = v.object({
  apiKey: v.pipe(v.string(), v.minLength(1, 'BREVO_API_KEY is required')),
})

export type BrevoConfig = v.InferOutput<typeof BrevoConfigSchema>

import * as v from 'valibot'

export const PostHogConfigSchema = v.object({
  apiKey: v.pipe(v.string(), v.minLength(1, 'POSTHOG_API_KEY is required')),
})

export type PostHogConfig = v.InferOutput<typeof PostHogConfigSchema>

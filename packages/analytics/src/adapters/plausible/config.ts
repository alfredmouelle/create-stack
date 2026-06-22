import * as v from 'valibot'

export const PlausibleConfigSchema = v.object({
  /** Site domain as registered in Plausible (e.g. `acme.com`). */
  domain: v.pipe(v.string(), v.minLength(1, 'Plausible domain is required')),
  /** Plausible host. Defaults to `https://plausible.io`. */
  apiHost: v.optional(v.string()),
})

export type PlausibleConfig = v.InferOutput<typeof PlausibleConfigSchema>

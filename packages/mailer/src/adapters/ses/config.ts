import * as v from 'valibot'

export const SesConfigSchema = v.object({
  /** AWS region. Falls back to the SDK's resolution (e.g. `AWS_REGION`). */
  region: v.optional(v.string()),
  /** Static credentials. Omit to let the SDK resolve them (env, profile, IAM). */
  accessKeyId: v.optional(v.string()),
  secretAccessKey: v.optional(v.string()),
  /** SES configuration set to attach (event publishing, dedicated IPs, …). */
  configurationSetName: v.optional(v.string()),
})

export type SesConfig = v.InferOutput<typeof SesConfigSchema>

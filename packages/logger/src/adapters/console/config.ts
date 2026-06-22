import * as v from 'valibot'

export const ConsoleConfigSchema = v.object({
  level: v.optional(v.picklist(['trace', 'debug', 'info', 'warn', 'error'] as const), 'info'),
})

export type ConsoleConfig = v.InferOutput<typeof ConsoleConfigSchema>

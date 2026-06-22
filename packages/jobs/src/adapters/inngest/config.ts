import * as v from 'valibot'

export const InngestConfigSchema = v.object({
  id: v.pipe(v.string(), v.minLength(1, 'Inngest app id is required')),
  eventKey: v.optional(v.string()),
})

export type InngestConfig = v.InferOutput<typeof InngestConfigSchema>

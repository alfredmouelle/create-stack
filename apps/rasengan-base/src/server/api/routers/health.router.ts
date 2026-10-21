import { createTRPCRouter, publicProcedure } from '~/server/api/trpc'

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    ok: true,
    time: new Date().toISOString(),
  })),
})

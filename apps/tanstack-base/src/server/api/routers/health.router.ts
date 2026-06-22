import { createTRPCRouter, publicProcedure } from '../trpc'

export const healthRouter = createTRPCRouter({
  ping: publicProcedure.query(() => ({
    ok: true,
    time: new Date().toISOString(),
  })),
})

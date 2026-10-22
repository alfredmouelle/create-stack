import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { flatten, ValiError } from 'valibot'
import { auth } from '~/server/better-auth'
import { db } from '~/server/db'

type TRPCContext = {
  readonly db: typeof db
  readonly session: Awaited<ReturnType<typeof auth.api.getSession>>
  readonly headers: Headers
}

export async function createTRPCContext({
  request,
}: {
  readonly request: Request
}): Promise<TRPCContext> {
  const session = await auth.api.getSession({ headers: request.headers })
  return { db, session, headers: request.headers }
}

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        validationError: error.cause instanceof ValiError ? flatten(error.cause.issues) : null,
      },
    }
  },
})

export const createCallerFactory = t.createCallerFactory
export const createTRPCRouter = t.router
export const publicProcedure = t.procedure
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session?.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next({ ctx: { session: { ...ctx.session, user: ctx.session.user } } })
})

import type { createTRPCContext } from '~/server/api/trpc'
import { auth } from '~/server/better-auth'
import { db } from '~/server/db'

type Context = Awaited<ReturnType<typeof createTRPCContext>>
type Session = NonNullable<Context['session']>

export function visitor(): Context {
  return { db, session: null, headers: new Headers() }
}

export async function signIn(
  user: { email?: string; name?: string } = {},
): Promise<{ user: Session['user']; context: Context }> {
  const context = await auth.$context
  const created = await context.internalAdapter.createUser(
    {
      email: user.email ?? 'jane.doe@example.com',
      name: user.name ?? 'Jane Doe',
      emailVerified: true,
    },
    { method: 'email-password' },
  )
  const session = await context.internalAdapter.createSession(created.id)
  return {
    user: created,
    context: { db, session: { user: created, session }, headers: new Headers() },
  }
}

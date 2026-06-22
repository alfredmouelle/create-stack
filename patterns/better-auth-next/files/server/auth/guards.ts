import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from '~/server/better-auth/server'

/** Require a signed-in user in a Server Component / page; redirect otherwise. */
export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/auth/sign-in')
  return session
}

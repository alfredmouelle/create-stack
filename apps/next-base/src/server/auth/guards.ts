import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from '~/server/better-auth/server'

/** Require signed-in user in a Server Component/page; else redirect. */
export async function requireAuth() {
  const session = await getSession()
  if (!session) redirect('/auth/sign-in')
  return session
}

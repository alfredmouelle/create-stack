import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getServerSession } from '~/server/better-auth/session'

/** Guards child routes: redirects to sign-in when no session; exposes session via `beforeLoad`. */
export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      throw redirect({ to: '/auth/sign-in' })
    }
    return { session }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  return <Outlet />
}

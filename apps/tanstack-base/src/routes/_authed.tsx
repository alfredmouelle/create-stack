import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getServerSession } from '~/server/better-auth/session'

export const Route = createFileRoute('/_authed')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (!session) {
      return redirect({ to: '/auth/sign-in' })
    }
    return { session }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  return <Outlet />
}

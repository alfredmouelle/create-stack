import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { getServerSession } from '~/server/better-auth/session'

export const Route = createFileRoute('/auth')({
  beforeLoad: async () => {
    const session = await getServerSession()
    if (session) {
      throw redirect({ to: '/' })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-b from-background to-muted/50 px-4 py-10">
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}

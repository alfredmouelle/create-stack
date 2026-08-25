import { createFileRoute, Link, Outlet, redirect } from '@tanstack/react-router'
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
      <Link
        className="flex items-center gap-2 font-mono text-muted-foreground text-xs tracking-[0.12em] transition-colors hover:text-foreground"
        to="/"
      >
        <span aria-hidden="true" className="text-base text-primary leading-none">
          &gt;_
        </span>
        create-stack
      </Link>
      <div className="w-full max-w-sm">
        <Outlet />
      </div>
    </div>
  )
}

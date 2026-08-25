import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AuthBrand } from '~/features/auth/auth-brand'
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
    <div className="min-h-svh bg-background p-4 sm:p-6 lg:p-10">
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
        <main className="order-1 flex items-center justify-center p-2 sm:p-8 lg:order-2 lg:p-12">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </main>
        <AuthBrand />
      </div>
    </div>
  )
}

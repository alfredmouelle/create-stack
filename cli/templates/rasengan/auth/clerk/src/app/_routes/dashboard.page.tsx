import { UserButton } from '@clerk/react'
import type { PageComponent } from 'rasengan'

const Dashboard: PageComponent = () => (
  <main className="p-8">
    <h1 className="font-heading font-semibold text-2xl">Dashboard</h1>
    <p className="mt-2 text-muted-foreground">Protected route.</p>
    <UserButton />
  </main>
)

Dashboard.loader = async ({ request }) => {
  const response = await fetch(new URL('/api/session', request.url), {
    headers: { cookie: request.headers.get('cookie') ?? '' }, credentials: 'include',
  })
  if (response.status === 401) return { redirect: '/sign-in' }
  if (!response.ok) throw new Error('Unable to load the current session')
  return { props: {} }
}

export default Dashboard

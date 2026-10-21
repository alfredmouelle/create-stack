import type { PageComponent } from 'rasengan'
import * as v from 'valibot'
import { Button } from '~/components/ui/button'
import { useSignOut } from '~/features/auth/use-sign-out'

const userSchema = v.object({ name: v.string(), email: v.pipe(v.string(), v.email()) })
const sessionSchema = v.nullable(v.object({ user: userSchema }))

const Dashboard: PageComponent<v.InferOutput<typeof userSchema>> = ({ name, email }) => {
  const { pending, signOut } = useSignOut()
  return (
    <main className="p-8">
      <h1 className="font-heading font-semibold text-2xl">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">
        {name}, {email}
      </p>
      <Button
        className="mt-6 cursor-pointer"
        disabled={pending}
        onClick={() => {
          void signOut()
        }}
      >
        {pending ? 'Signing out...' : 'Sign out'}
      </Button>
    </main>
  )
}

Dashboard.loader = async ({ request }) => {
  const response = await fetch(new URL('/api/auth/get-session', request.url), {
    headers: { cookie: request.headers.get('cookie') ?? '' },
    credentials: 'include',
  })
  if (!response.ok) throw new Error('Unable to load the current session')
  const value: unknown = await response.json()
  const session = v.parse(sessionSchema, value)
  return session ? { props: session.user } : { redirect: '/auth/sign-in' }
}

Dashboard.metadata = { title: 'Dashboard' }

export default Dashboard

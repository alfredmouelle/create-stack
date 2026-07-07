import { RedirectToSignIn, UserButton, useAuth } from '@clerk/tanstack-react-start'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({ component: Dashboard })

function Dashboard() {
  const { isLoaded, isSignedIn } = useAuth()
  if (!isLoaded) return null
  if (!isSignedIn) return <RedirectToSignIn />

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading font-medium text-2xl">Dashboard</h1>
        <UserButton />
      </div>
      <p className="mt-2 text-muted-foreground">Protected route.</p>
    </div>
  )
}

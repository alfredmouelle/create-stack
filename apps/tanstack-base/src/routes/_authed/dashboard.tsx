import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/dashboard')({ component: Dashboard })

function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="font-heading font-medium text-2xl">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Protected route.</p>
    </div>
  )
}

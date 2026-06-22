import { requireAuth } from '~/server/auth/guards'

export default async function DashboardPage() {
  await requireAuth()

  return (
    <main className="p-8">
      <h1 className="font-heading font-medium text-2xl">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Protected route.</p>
    </main>
  )
}

import { UserButton } from '@clerk/nextjs'

export default function DashboardPage() {
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

import { createFileRoute } from '@tanstack/react-router'
import { ThemeToggle } from '~/components/theme-toggle'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-4xl">Base</h1>
        <ThemeToggle />
      </div>
      <p className="mt-4 text-lg">
        TanStack Start base. Add tools with <code>add-capability</code>.
      </p>
    </div>
  )
}

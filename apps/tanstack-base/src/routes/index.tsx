import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-4xl">Base</h1>
      <p className="mt-4 text-lg">
        TanStack Start base. Add tools with <code>add-capability</code>.
      </p>
    </div>
  )
}

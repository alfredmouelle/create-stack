import { ThemeToggle } from '~/components/theme-toggle'

export default function Home() {
  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-4xl">Base</h1>
        <ThemeToggle />
      </div>
      <p className="mt-4 text-lg">
        Next.js base. Add tools with <code>add-capability</code>.
      </p>
    </main>
  )
}

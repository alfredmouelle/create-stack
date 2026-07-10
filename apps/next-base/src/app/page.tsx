import { ThemeToggle } from '~/components/theme-toggle'
import { Button } from '~/components/ui/button'

export default function Home() {
  return (
    <main className="relative flex min-h-svh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[460px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_16%,transparent)_0%,transparent_100%)]" />
      <header className="relative flex items-center justify-between px-6 py-5">
        <span className="font-mono text-muted-foreground text-sm">create-stack</span>
        <ThemeToggle />
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="max-w-3xl text-balance font-semibold text-5xl tracking-tight sm:text-6xl">
          Everything&rsquo;s wired.
          <br />
          Start building.
        </h1>

        <p className="mt-5 max-w-xl text-balance text-lg text-muted-foreground">
          A real, fully-typed starter with the database, auth and API already in place. Edit{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">src/app/page.tsx</code>{' '}
          to make it yours.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <a href="https://create-stack.alfredmouelle.com" rel="noreferrer" target="_blank">
              Documentation
            </a>
          </Button>
          <Button asChild size="lg" variant="outline">
            <a
              href="https://github.com/alfredmouelle/create-stack"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
          </Button>
        </div>

        <div className="mt-12 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-background/70 text-left shadow-sm backdrop-blur">
          <div className="flex items-center gap-1.5 border-border border-b bg-muted/50 px-4 py-2.5">
            <span className="size-3 rounded-full bg-red-400/70" />
            <span className="size-3 rounded-full bg-yellow-400/70" />
            <span className="size-3 rounded-full bg-green-400/70" />
            <span className="ml-2 font-mono text-muted-foreground text-xs">zsh</span>
          </div>
          <div className="space-y-1.5 p-4 font-mono text-sm leading-relaxed">
            <p>
              <span className="text-muted-foreground">$</span> create-stack my-app
            </p>
            <p className="text-muted-foreground">✓ forked base, stripped to selection, installed</p>
            <p className="text-muted-foreground">✓ typecheck + biome clean</p>
            <p>
              <span className="text-primary">→</span> ready on http://localhost:3000
            </p>
          </div>
        </div>
      </div>

      <footer className="relative px-6 py-5 text-center text-muted-foreground text-xs">
        Scaffolded with create-stack
      </footer>
    </main>
  )
}

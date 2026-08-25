import { createFileRoute } from '@tanstack/react-router'
import { ThemeToggle } from '~/components/theme-toggle'
import { siteConfig } from '~/lib/site-config'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="min-h-svh bg-background">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <a
            aria-label={`${siteConfig.name} home`}
            className="flex cursor-pointer items-center gap-3"
            href="/"
          >
            <img
              alt=""
              aria-hidden="true"
              className="size-8 rounded-lg"
              height="32"
              src="/logo192.png"
              width="32"
            />
            <span className="font-heading font-semibold tracking-tight">{siteConfig.name}</span>
          </a>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-6 py-12 sm:py-20">
        <section className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-end">
          <div>
            <p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
              Ready when you are
            </p>
            <h1 className="mt-4 max-w-3xl text-balance font-heading font-medium text-5xl tracking-[-0.05em] sm:text-7xl">
              A clear place to start.
            </h1>
            <p className="mt-6 max-w-2xl text-balance text-lg text-muted-foreground sm:text-xl">
              Your application is ready for its first real feature. Replace this screen with the
              part of your product you want to build next.
            </p>
            <p className="mt-6 max-w-xl text-muted-foreground text-sm leading-6">
              Open{' '}
              <code className="rounded-md bg-muted px-1.5 py-1 font-mono text-foreground text-xs">
                src/routes/index.tsx
              </code>{' '}
              and make the first change.
            </p>
          </div>

          <aside className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
            <div className="flex items-center justify-between font-mono text-muted-foreground text-xs uppercase tracking-[0.14em]">
              <span>Start here</span>
              <span>01</span>
            </div>
            <h2 className="mt-10 font-heading font-medium text-2xl tracking-tight">
              Make the first change.
            </h2>
            <p className="mt-3 text-muted-foreground text-sm leading-6">
              Keep this page, replace it, or use it as a quick check that the app is running.
            </p>
            <div className="mt-8 flex items-center gap-3 border-border border-t pt-4">
              <span className="size-2 rounded-full bg-primary" />
              <code className="font-mono text-muted-foreground text-xs">localhost:3000</code>
            </div>
          </aside>
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-between gap-4 border-border border-t pt-6 text-muted-foreground text-xs">
          <span>Built with create-stack.</span>
          <a
            className="cursor-pointer font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
            href="https://create-stack.alfredmouelle.com"
            rel="noreferrer"
            target="_blank"
          >
            Read the docs <span aria-hidden="true">↗</span>
          </a>
        </footer>
      </div>
    </main>
  )
}

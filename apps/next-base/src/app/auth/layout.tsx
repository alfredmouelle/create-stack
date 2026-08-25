import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-b from-background to-muted/50 px-4 py-10">
      <Link
        className="flex items-center gap-2 font-mono text-muted-foreground text-xs tracking-[0.12em] transition-colors hover:text-foreground"
        href="/"
      >
        <span aria-hidden="true" className="text-base text-primary leading-none">
          &gt;_
        </span>
        create-stack
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

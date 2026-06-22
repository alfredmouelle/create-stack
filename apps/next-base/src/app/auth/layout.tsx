import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-gradient-to-b from-background to-muted/50 px-4 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

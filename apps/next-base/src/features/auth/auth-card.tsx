import type { ReactNode } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'

interface AuthCardProps {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <Card className="gap-0 rounded-2xl border-border/60 py-0 shadow-[0_2px_8px_-2px_var(--color-border),0_12px_32px_-12px_var(--color-border)]">
      <CardHeader className="px-8 pt-8 pb-0">
        <CardTitle className="font-semibold text-2xl tracking-tight">{title}</CardTitle>
        {description ? (
          <CardDescription className="pt-1 leading-relaxed">{description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="px-8 pt-6 pb-8">{children}</CardContent>

      {footer ? (
        <div className="border-border/60 border-t px-8 py-5 text-center text-muted-foreground text-sm">
          {footer}
        </div>
      ) : null}
    </Card>
  )
}

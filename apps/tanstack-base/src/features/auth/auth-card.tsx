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
    <Card className="relative gap-0 rounded-2xl border-border/70 bg-card py-0 shadow-none ring-1 ring-foreground/5">
      <div aria-hidden="true" className="h-1 bg-primary" />

      <CardHeader className="px-8 pt-9 pb-0">
        <CardTitle className="font-heading font-medium text-3xl tracking-[-0.04em]">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="pt-1 leading-relaxed">{description}</CardDescription>
        ) : null}
      </CardHeader>

      <CardContent className="px-8 pt-7 pb-8">{children}</CardContent>

      {footer ? (
        <div className="border-border/70 border-t bg-muted/20 px-8 py-5 text-center text-muted-foreground text-sm">
          {footer}
        </div>
      ) : null}
    </Card>
  )
}

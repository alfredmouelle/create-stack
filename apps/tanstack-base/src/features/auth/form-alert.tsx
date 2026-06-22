import { CircleAlert, CircleCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '~/lib/utils'

interface FormAlertProps {
  variant?: 'error' | 'success'
  children: ReactNode
}

export function FormAlert({ variant = 'error', children }: FormAlertProps) {
  const Icon = variant === 'success' ? CircleCheck : CircleAlert

  return (
    <div
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed',
        variant === 'error'
          ? 'border-destructive/20 bg-destructive/8 text-destructive'
          : 'border-border bg-muted/60 text-foreground',
      )}
      role="alert"
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

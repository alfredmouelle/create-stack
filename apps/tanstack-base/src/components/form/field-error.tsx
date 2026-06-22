import type { AnyFieldApi } from '@tanstack/react-form'

const errorMessage = (error: unknown): string =>
  typeof error === 'string' ? error : ((error as { message?: string } | undefined)?.message ?? '')

export function hasFieldError(field: AnyFieldApi): boolean {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0
}

export function FieldError({ field }: { field: AnyFieldApi }) {
  const { isTouched, errors } = field.state.meta
  if (!isTouched || errors.length === 0) return null

  const message = errors.map(errorMessage).filter(Boolean).join(', ')
  if (!message) return null

  return <p className="text-destructive text-xs">{message}</p>
}

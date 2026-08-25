import type { AnyFieldApi } from '@tanstack/react-form'

const errorMessage = (error: unknown): string =>
  typeof error === 'string' ? error : ((error as { message?: string } | undefined)?.message ?? '')

export function hasFieldError(field: AnyFieldApi): boolean {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0
}

export function FieldError({ field }: { field: AnyFieldApi }) {
  const { isTouched, errors } = field.state.meta
  const message =
    isTouched && errors.length > 0 ? errors.map(errorMessage).filter(Boolean).join(', ') : ''

  return <p className="min-h-5 text-destructive text-xs">{message}</p>
}

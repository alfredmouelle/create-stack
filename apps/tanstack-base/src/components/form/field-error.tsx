export type FieldErrorState = {
  readonly state: {
    readonly meta: {
      readonly isTouched: boolean
      readonly errors: readonly unknown[]
    }
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message
  return ''
}

export function hasFieldError(field: FieldErrorState): boolean {
  return field.state.meta.isTouched && field.state.meta.errors.length > 0
}

export function FieldError({ field }: { readonly field: FieldErrorState }) {
  const { isTouched, errors } = field.state.meta
  const message = isTouched
    ? errors
        .map((error) => errorMessage(error))
        .filter(Boolean)
        .join(', ')
    : ''
  return <p className="min-h-5 text-destructive text-xs">{message}</p>
}

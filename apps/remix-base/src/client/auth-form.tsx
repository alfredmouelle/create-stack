import type { Handle } from 'remix/component'
import { clientEntry, on } from 'remix/component'
import {
  buttonBase,
  buttonDefault,
  buttonOutline,
  inputClasses,
  labelClasses,
} from './ui-styles.ts'

export type AuthField = {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'hidden'
  autocomplete: string
  value: string
  required: boolean
  minLength: number
  maxLength: number
}

function AuthInput(handle: Handle<{ field: AuthField }>) {
  return () => {
    const field = handle.props.field
    const props = {
      id: `auth-${field.name}`,
      name: field.name,
      autoComplete: field.autocomplete,
      defaultValue: field.value,
      required: field.required,
      minLength: field.minLength,
      maxLength: field.maxLength,
      class: inputClasses,
      'data-slot': 'form-control',
      placeholder:
        field.type === 'email'
          ? 'you@example.com'
          : field.name === 'name'
            ? 'Your name'
            : field.name === 'password' && field.autocomplete === 'new-password'
              ? 'At least 8 characters'
              : undefined,
    }
    if (field.type === 'email') return <input type="email" {...props} />
    if (field.type === 'text') return <input type="text" {...props} />
    return <input type={field.type} {...props} />
  }
}

function SocialSignin(handle: Handle<{ action: string; pending: boolean }>) {
  return () => (
    <>
      <button
        class={`${buttonBase.replace('border-transparent', '')} ${buttonOutline} w-full`}
        disabled={handle.props.pending}
        formAction="/auth/google"
        formNoValidate
        type="submit"
      >
        <svg aria-hidden="true" class="size-4" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {handle.props.action === '/auth/sign-up' ? 'Sign up with Google' : 'Continue with Google'}
      </button>
      <div class="flex items-center gap-3 text-muted-foreground text-xs">
        <span class="h-px flex-1 bg-border" />
        or
        <span class="h-px flex-1 bg-border" />
      </div>
    </>
  )
}

export const AuthForm = clientEntry(
  import.meta.url,
  function AuthForm(
    handle: Handle<{
      action: string
      label: string
      fields: AuthField[]
      disabled?: boolean
    }>,
  ) {
    let pending = false
    handle.queueTask(() => {
      handle.frame.addEventListener(
        'reloadComplete',
        () => {
          pending = false
          void handle.update()
        },
        { signal: handle.signal },
      )
    })
    return () => {
      return (
        <form
          action={handle.props.action}
          aria-busy={pending}
          class="grid gap-4"
          method="post"
          mix={on('submit', () => {
            pending = true
            void handle.update()
          })}
        >
          {['/auth/sign-in', '/auth/sign-up'].includes(handle.props.action) ? (
            <SocialSignin action={handle.props.action} pending={pending} />
          ) : null}
          {handle.props.fields.map((field) => (
            <div class={field.type === 'hidden' ? 'hidden' : 'grid gap-2'} key={field.name}>
              {field.type === 'hidden' ? null : (
                <label class={labelClasses} for={`auth-${field.name}`}>
                  {field.label}
                </label>
              )}
              <AuthInput field={field} />
              {field.name === 'password' && handle.props.action === '/auth/sign-in' ? (
                <a
                  class="cursor-pointer justify-self-end text-muted-foreground text-xs hover:underline"
                  href="/auth/forgot-password"
                >
                  Forgot password?
                </a>
              ) : null}
              {field.type === 'hidden' ? null : (
                <p class="min-h-5 text-destructive text-xs" data-slot="form-message" />
              )}
            </div>
          ))}
          <button
            class={`${buttonBase} ${handle.props.action === '/auth/verify-email' ? buttonOutline : buttonDefault} w-full`}
            disabled={pending || handle.props.disabled}
            type="submit"
          >
            {pending
              ? ({
                  '/auth/sign-in': 'Signing in…',
                  '/auth/sign-up': 'Creating…',
                  '/auth/reset-password': 'Saving…',
                }[handle.props.action] ?? 'Sending…')
              : handle.props.label}
          </button>
        </form>
      )
    }
  },
)

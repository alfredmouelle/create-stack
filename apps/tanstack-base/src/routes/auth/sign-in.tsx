import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Lock, Mail } from 'lucide-react'
import { useState } from 'react'
import { TextField } from '~/components/form/text-field'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { AuthCard } from '~/features/auth/auth-card'
import { FormAlert } from '~/features/auth/form-alert'
import { AuthDivider, GoogleButton } from '~/features/auth/google-button'
import { SignInSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export const Route = createFileRoute('/auth/sign-in')({ component: SignIn })

function SignIn() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onBlur: SignInSchema },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await authClient.signIn.email({
        email: value.email,
        password: value.password,
      })

      if (!error) {
        await navigate({ to: '/' })
        return
      }

      if (error.code === 'EMAIL_NOT_VERIFIED') {
        await navigate({ to: '/auth/verify-email', search: { email: value.email } })
        return
      }

      setFormError(
        error.code === 'INVALID_EMAIL_OR_PASSWORD'
          ? 'Incorrect email or password.'
          : (error.message ?? 'Could not sign in. Try again.'),
      )
    },
  })

  return (
    <AuthCard
      description="Sign in to your account."
      footer={
        <>
          No account yet?{' '}
          <Link className="ml-1 text-foreground hover:underline" to="/auth/sign-up">
            Create an account
          </Link>
        </>
      }
      title="Sign in"
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <GoogleButton label="Continue with Google" />
        <AuthDivider />

        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <form.Field name="email">
          {(field) => (
            <TextField
              autoComplete="email"
              field={field}
              icon={<Mail />}
              label="Email"
              placeholder="you@example.com"
              type="email"
            />
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className="grid gap-2">
              <TextField
                autoComplete="current-password"
                field={field}
                icon={<Lock />}
                label="Password"
                type="password"
              />
              <Link
                className="justify-self-end text-muted-foreground text-xs hover:underline"
                to="/auth/forgot-password"
              >
                Forgot password?
              </Link>
            </div>
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button className="w-full cursor-pointer" disabled={!canSubmit} type="submit">
              {isSubmitting ? <Spinner /> : null}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthCard>
  )
}

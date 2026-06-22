import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Lock, Mail, User } from 'lucide-react'
import { useState } from 'react'
import { TextField } from '~/components/form/text-field'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { AuthCard } from '~/features/auth/auth-card'
import { FormAlert } from '~/features/auth/form-alert'
import { AuthDivider, GoogleButton } from '~/features/auth/google-button'
import { SignUpSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export const Route = createFileRoute('/auth/sign-up')({ component: SignUp })

function SignUp() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm({
    defaultValues: { name: '', email: '', password: '' },
    validators: { onBlur: SignUpSchema },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        callbackURL: '/',
      })

      if (!error) {
        await navigate({ to: '/auth/verify-email', search: { email: value.email } })
        return
      }

      setFormError(
        error.code === 'USER_ALREADY_EXISTS'
          ? 'An account already exists with this email.'
          : (error.message ?? 'Could not sign up. Try again.'),
      )
    },
  })

  return (
    <AuthCard
      description="Create your account."
      footer={
        <>
          Already have an account?{' '}
          <Link className="ml-1 text-foreground hover:underline" to="/auth/sign-in">
            Sign in
          </Link>
        </>
      }
      title="Create an account"
    >
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
      >
        <GoogleButton label="Sign up with Google" />
        <AuthDivider />

        {formError ? <FormAlert>{formError}</FormAlert> : null}

        <form.Field name="name">
          {(field) => (
            <TextField
              autoComplete="name"
              field={field}
              icon={<User />}
              label="Name"
              placeholder="Your name"
            />
          )}
        </form.Field>

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
            <TextField
              autoComplete="new-password"
              field={field}
              icon={<Lock />}
              label="Password"
              placeholder="At least 8 characters"
              type="password"
            />
          )}
        </form.Field>

        <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <Button className="w-full cursor-pointer" disabled={!canSubmit} type="submit">
              {isSubmitting ? <Spinner /> : null}
              {isSubmitting ? 'Creating…' : 'Create account'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthCard>
  )
}

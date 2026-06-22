import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { TextField } from '~/components/form/text-field'
import { Button } from '~/components/ui/button'
import { AuthCard } from '~/features/auth/auth-card'
import { FormAlert } from '~/features/auth/form-alert'
import { ForgotPasswordSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPassword,
})

function ForgotPassword() {
  const [formError, setFormError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  const form = useForm({
    defaultValues: { email: '' },
    validators: { onBlur: ForgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setFormError(null)
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: '/auth/reset-password',
      })

      if (error) {
        setFormError(error.message ?? 'Could not send. Try again.')
        return
      }
      setSent(true)
    },
  })

  return (
    <AuthCard
      description="Enter your email to receive a reset link."
      footer={
        <Link className="text-foreground hover:underline" to="/auth/sign-in">
          Back to sign in
        </Link>
      }
      title="Forgot password"
    >
      {sent ? (
        <FormAlert variant="success">
          If an account exists for this address, a reset email has just been sent. Check your spam
          folder.
        </FormAlert>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
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

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button className="w-full cursor-pointer" disabled={!canSubmit} type="submit">
                {isSubmitting ? 'Sending…' : 'Send link'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
    </AuthCard>
  )
}

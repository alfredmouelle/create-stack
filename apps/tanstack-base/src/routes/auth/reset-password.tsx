import { useForm } from '@tanstack/react-form'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { TextField } from '~/components/form/text-field'
import { Button } from '~/components/ui/button'
import { AuthCard } from '~/features/auth/auth-card'
import { FormAlert } from '~/features/auth/form-alert'
import { ResetPasswordSchema } from '~/features/auth/schemas'
import { authClient } from '~/server/better-auth/client'

interface ResetPasswordSearch {
  token?: string
  error?: string
}

export const Route = createFileRoute('/auth/reset-password')({
  validateSearch: (search: Record<string, unknown>): ResetPasswordSearch => ({
    token: typeof search.token === 'string' ? search.token : undefined,
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  component: ResetPassword,
})

function ResetPassword() {
  const navigate = useNavigate()
  const { token, error: tokenError } = Route.useSearch()
  const [formError, setFormError] = useState<string | null>(null)

  const invalidToken = !token || tokenError === 'INVALID_TOKEN'

  const form = useForm({
    defaultValues: { password: '', confirmPassword: '' },
    validators: { onBlur: ResetPasswordSchema },
    onSubmit: async ({ value }) => {
      if (!token) return
      setFormError(null)
      const { error } = await authClient.resetPassword({
        newPassword: value.password,
        token,
      })

      if (error) {
        setFormError(error.message ?? 'Could not reset password.')
        return
      }
      await navigate({ to: '/auth/sign-in' })
    },
  })

  return (
    <AuthCard
      description="Choose a new password for your account."
      footer={
        <Link className="text-foreground hover:underline" to="/auth/forgot-password">
          Request a new link
        </Link>
      }
      title="New password"
    >
      {invalidToken ? (
        <FormAlert>This reset link is invalid or expired. Please request a new one.</FormAlert>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
        >
          {formError ? <FormAlert>{formError}</FormAlert> : null}

          <form.Field name="password">
            {(field) => (
              <TextField
                autoComplete="new-password"
                field={field}
                icon={<Lock />}
                label="New password"
                placeholder="At least 8 characters"
                type="password"
              />
            )}
          </form.Field>

          <form.Field name="confirmPassword">
            {(field) => (
              <TextField
                autoComplete="new-password"
                field={field}
                icon={<Lock />}
                label="Confirm password"
                type="password"
              />
            )}
          </form.Field>

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button className="w-full cursor-pointer" disabled={!canSubmit} type="submit">
                {isSubmitting ? 'Saving…' : 'Reset password'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
    </AuthCard>
  )
}

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { AuthCard } from '~/features/auth/auth-card'
import { FormAlert } from '~/features/auth/form-alert'
import { authClient } from '~/server/better-auth/client'

interface VerifyEmailSearch {
  email?: string
}

export const Route = createFileRoute('/auth/verify-email')({
  validateSearch: (search: Record<string, unknown>): VerifyEmailSearch => ({
    email: typeof search.email === 'string' ? search.email : undefined,
  }),
  component: VerifyEmail,
})

function VerifyEmail() {
  const { email } = Route.useSearch()
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const resend = async () => {
    if (!email) return
    setStatus('sending')
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/' })
    setStatus(error ? 'error' : 'sent')
  }

  return (
    <AuthCard
      description={
        <>
          A confirmation link was sent{email ? ` to ${email}` : ''}. Click it to activate your
          account.
        </>
      }
      footer={
        <Link className="text-foreground hover:underline" to="/auth/sign-in">
          Back to sign in
        </Link>
      }
      title="Confirm your email"
    >
      <div className="grid gap-4">
        {status === 'sent' ? (
          <FormAlert variant="success">
            Request sent. If your address isn't confirmed yet, you'll get an email — check your spam
            folder.
          </FormAlert>
        ) : null}
        {status === 'error' ? <FormAlert>Could not send. Try again shortly.</FormAlert> : null}

        <p className="text-muted-foreground text-sm">
          Didn't get anything? Check your spam folder or resend the link.
        </p>

        <Button
          className="w-full cursor-pointer"
          disabled={!email || status === 'sending'}
          onClick={resend}
          type="button"
          variant="outline"
        >
          {status === 'sending' ? <Spinner /> : null}
          {status === 'sending' ? 'Sending…' : 'Resend link'}
        </Button>
      </div>
    </AuthCard>
  )
}

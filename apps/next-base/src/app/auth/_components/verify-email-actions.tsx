'use client'

import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Spinner } from '~/components/ui/spinner'
import { FormAlert } from '~/features/auth/form-alert'
import { authClient } from '~/server/better-auth/client'

export function VerifyEmailActions({ email }: { email?: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const resend = async () => {
    if (!email) return
    setStatus('sending')
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: '/' })
    setStatus(error ? 'error' : 'sent')
  }

  return (
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
  )
}

'use client'

import { useState } from 'react'
import { createCallable } from 'react-call'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '~/components/ui/input-otp'

export interface ConfirmOtpProps {
  title: string
  description?: string
  length?: number
  confirmLabel?: string
  cancelLabel?: string
  verify: (code: string) => Promise<boolean>
}

export const ConfirmOtp = createCallable<ConfirmOtpProps, boolean>(
  ({
    call,
    title,
    description,
    length = 6,
    confirmLabel = 'Verify',
    cancelLabel = 'Cancel',
    verify,
  }) => {
    const [value, setValue] = useState('')
    const [error, setError] = useState<string | null>(null)
    const [pending, setPending] = useState(false)

    const submit = async (code: string) => {
      setPending(true)
      setError(null)
      try {
        if (await verify(code)) {
          call.end(true)
          return
        }
        setError('Invalid code. Try again.')
      } catch {
        setError('Something went wrong. Try again.')
      }
      setValue('')
      setPending(false)
    }

    return (
      <Dialog open={!call.ended} onOpenChange={(open) => !open && call.end(false)}>
        <DialogContent showCloseButton={false}>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (value.length === length && !pending) submit(value)
            }}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <div className="grid justify-items-center gap-2">
              <InputOTP
                maxLength={length}
                value={value}
                disabled={pending}
                onChange={setValue}
                onComplete={submit}
                // biome-ignore lint/a11y/noAutofocus: focus the code input the dialog exists for
                autoFocus
              >
                <InputOTPGroup>
                  {Array.from({ length }, (_, index) => (
                    <InputOTPSlot key={index} index={index} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <p className="min-h-5 text-destructive text-sm" role="alert">
                {error}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => call.end(false)}
              >
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={value.length !== length || pending}>
                {pending ? 'Verifying...' : confirmLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  },
  200,
)

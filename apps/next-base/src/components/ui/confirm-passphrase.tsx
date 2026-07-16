'use client'

import { useId, useState } from 'react'
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
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'

export interface ConfirmPassphraseProps {
  title: string
  description?: string
  phrase: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export const ConfirmPassphrase = createCallable<ConfirmPassphraseProps, boolean>(
  ({
    call,
    title,
    description,
    phrase,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'destructive',
  }) => {
    const id = useId()
    const [value, setValue] = useState('')
    const matches = value === phrase

    return (
      <Dialog open={!call.ended} onOpenChange={(open) => !open && call.end(false)}>
        <DialogContent showCloseButton={false}>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (matches) call.end(true)
            }}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <div className="grid gap-2">
              <Label htmlFor={id}>
                Type <span className="font-medium text-foreground">{phrase}</span> to continue
              </Label>
              <Input
                id={id}
                autoComplete="off"
                // biome-ignore lint/a11y/noAutofocus: focus the field the dialog exists for
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => call.end(false)}>
                {cancelLabel}
              </Button>
              <Button type="submit" variant={variant} disabled={!matches}>
                {confirmLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    )
  },
  200,
)

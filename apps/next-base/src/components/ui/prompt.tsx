'use client'

// Await it from anywhere; the <Prompt /> Root is auto-mounted by `create-stack component`.
// const name = await Prompt.call({ title: 'Rename', label: 'Name', defaultValue: 'my-app' })

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

export interface PromptProps {
  title: string
  description?: string
  label?: string
  defaultValue?: string
  placeholder?: string
  confirmLabel?: string
  cancelLabel?: string
  required?: boolean
}

export const Prompt = createCallable<PromptProps, string | null>(
  ({
    call,
    title,
    description,
    label,
    defaultValue = '',
    placeholder,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    required = true,
  }) => {
    const id = useId()
    const [value, setValue] = useState(defaultValue)
    const canSubmit = !required || value.trim().length > 0

    return (
      <Dialog open={!call.ended} onOpenChange={(open) => !open && call.end(null)}>
        <DialogContent showCloseButton={false}>
          <form
            className="grid gap-6"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSubmit) call.end(value)
            }}
          >
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              {description && <DialogDescription>{description}</DialogDescription>}
            </DialogHeader>
            <div className="grid gap-2">
              {label && <Label htmlFor={id}>{label}</Label>}
              <Input
                id={id}
                // biome-ignore lint/a11y/noAutofocus: focus the field the dialog exists for
                autoFocus
                placeholder={placeholder}
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => call.end(null)}>
                {cancelLabel}
              </Button>
              <Button type="submit" disabled={!canSubmit}>
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

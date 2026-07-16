'use client'

// Await it from anywhere; the <Confirm /> Root is auto-mounted by `create-stack component`.
// const ok = await Confirm.call({ title: 'Delete project?', variant: 'destructive' })

import { createCallable } from 'react-call'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

export interface ConfirmProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
}

export const Confirm = createCallable<ConfirmProps, boolean>(
  ({
    call,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
  }) => (
    <AlertDialog open={!call.ended} onOpenChange={(open) => !open && call.end(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => call.end(false)}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant={variant} onClick={() => call.end(true)}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  200,
)

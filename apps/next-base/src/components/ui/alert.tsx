'use client'

// Await it from anywhere; the <Alert /> Root is auto-mounted by `create-stack component`.
// await Alert.call({ title: 'Saved', description: 'Your changes are live.' })

import { createCallable } from 'react-call'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

export interface AlertProps {
  title: string
  description?: string
  confirmLabel?: string
}

export const Alert = createCallable<AlertProps, void>(
  ({ call, title, description, confirmLabel = 'OK' }) => (
    <AlertDialog open={!call.ended} onOpenChange={(open) => !open && call.end()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={() => call.end()}>{confirmLabel}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
  200,
)

import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import type { DialogProps } from './dialog-options.ts'
import { callDialog, createDialog } from './dialog.tsx'

export type AlertProps = DialogProps<'alert'>

export const Alert = Object.assign(clientEntry(import.meta.url, function Alert(handle: Handle) {
  return createDialog(handle, 'Alert')
}), {
  async call(options: AlertProps) {
    await callDialog('Alert', { ...options, mode: 'alert' })
  },
})

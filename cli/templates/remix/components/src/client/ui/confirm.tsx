import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import type { DialogProps } from './dialog-options.ts'
import { callDialog, createDialog } from './dialog.tsx'

export type ConfirmProps = DialogProps<'confirm'>

export const Confirm = Object.assign(clientEntry(import.meta.url, function Confirm(handle: Handle) {
  return createDialog(handle, 'Confirm')
}), {
  async call(options: ConfirmProps) {
    const result = await callDialog('Confirm', { ...options, mode: 'confirm' })
    return result === true
  },
})

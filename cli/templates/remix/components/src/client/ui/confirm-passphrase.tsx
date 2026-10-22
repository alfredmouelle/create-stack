import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import type { DialogProps } from './dialog-options.ts'
import { callDialog, createDialog } from './dialog.tsx'

export type ConfirmPassphraseProps = DialogProps<'passphrase'>

export const ConfirmPassphrase = Object.assign(clientEntry(import.meta.url, function ConfirmPassphrase(handle: Handle) {
  return createDialog(handle, 'ConfirmPassphrase')
}), {
  async call(options: ConfirmPassphraseProps) {
    const result = await callDialog('ConfirmPassphrase', { ...options, mode: 'passphrase' })
    return result === true
  },
})

import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import type { DialogProps } from './dialog-options.ts'
import { callDialog, createDialog } from './dialog.tsx'

export type ConfirmOtpProps = DialogProps<'otp'>

export const ConfirmOtp = Object.assign(clientEntry(import.meta.url, function ConfirmOtp(handle: Handle) {
  return createDialog(handle, 'ConfirmOtp')
}), {
  async call(options: ConfirmOtpProps) {
    const result = await callDialog('ConfirmOtp', { ...options, mode: 'otp' })
    return result === true
  },
})

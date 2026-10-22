import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import type { DialogProps } from './dialog-options.ts'
import { callDialog, createDialog } from './dialog.tsx'

export type ChoiceProps = DialogProps<'choice'>

export const Choice = Object.assign(clientEntry(import.meta.url, function Choice(handle: Handle) {
  return createDialog(handle, 'Choice')
}), {
  async call(options: ChoiceProps) {
    const result = await callDialog('Choice', { ...options, mode: 'choice' })
    return typeof result === 'string' ? result : null
  },
})

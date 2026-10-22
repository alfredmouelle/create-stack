import { clientEntry } from 'remix/component'
import type { Handle } from 'remix/component'
import type { DialogProps } from './dialog-options.ts'
import { callDialog, createDialog } from './dialog.tsx'

export type PromptProps = DialogProps<'prompt'>

export const Prompt = Object.assign(clientEntry(import.meta.url, function Prompt(handle: Handle) {
  return createDialog(handle, 'Prompt')
}), {
  async call(options: PromptProps) {
    const result = await callDialog('Prompt', { ...options, mode: 'prompt' })
    return typeof result === 'string' ? result : null
  },
})

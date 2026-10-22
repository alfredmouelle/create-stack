export type DialogPresentation = {
  readonly title: string
  readonly description?: string
  readonly confirmLabel?: string
  readonly cancelLabel?: string
  readonly variant?: 'default' | 'destructive'
}

export type DialogInput = {
  readonly label?: string
  readonly defaultValue?: string
  readonly placeholder?: string
  readonly required?: boolean
}

export type DialogModes = {
  readonly prompt: DialogInput
  readonly choice: { readonly options: readonly { readonly label: string; readonly value: string; readonly description?: string }[] }
  readonly passphrase: Pick<DialogInput, 'label' | 'placeholder'> & { readonly phrase: string }
  readonly otp: Pick<DialogInput, 'label' | 'placeholder'> & { readonly length?: number; readonly verify: (code: string) => Promise<boolean> }
}

export type DialogMode = keyof DialogModes | 'confirm' | 'alert'
export type DialogProps<Mode extends DialogMode> = DialogPresentation & (Mode extends keyof DialogModes ? DialogModes[Mode] : unknown)
export type DialogOptions = { [Mode in DialogMode]: DialogProps<Mode> & { readonly mode: Mode } }[DialogMode]



export function canSubmitDialog(options: DialogOptions, value: string): boolean {
  if (options.mode === 'passphrase') return value === options.phrase
  if (options.mode === 'prompt') return options.required === false || value.trim().length > 0
  if (options.mode === 'otp') return new RegExp(`^[0-9]{${options.length ?? 6}}$`, 'u').test(value)
  return true
}

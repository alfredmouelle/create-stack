import { on, ref } from 'remix/component'
import type { Handle } from 'remix/component'
import { buttonBase, buttonDefault, buttonOutline, inputClasses } from '../ui-styles.ts'
import { canSubmitDialog, type DialogOptions } from './dialog-options.ts'

type ViewProps = {
  readonly name: string
  readonly options: DialogOptions
  readonly value: string
  readonly error: string
  readonly busy: boolean
  readonly onSubmit: () => void
  readonly onCancel: () => void
  readonly onInput: (value: string) => void
}

function dialogLabel(options: DialogOptions): string {
  if (options.mode === 'passphrase') return `Type ${options.phrase} to confirm`
  if (options.mode === 'otp') return 'Verification code'
  return options.mode === 'prompt' ? options.label ?? 'Value' : ''
}

function confirmLabel(options: DialogOptions, busy: boolean): string {
  if (busy) return 'Verifying…'
  if (options.confirmLabel !== undefined) return options.confirmLabel
  if (options.mode === 'alert') return 'OK'
  return options.mode === 'otp' ? 'Verify' : 'Confirm'
}

function DialogField(handle: Handle<ViewProps>) {
  return () => {
    const { name, options, value, error, busy, onInput } = handle.props
    if (options.mode === 'choice') return <div class="grid gap-2">{options.options.map((option) => <button key={option.value} type="button" class={`${buttonBase.replace('border-transparent ', '')} ${buttonOutline}`} mix={on('click', () => { onInput(option.value); handle.props.onSubmit() })}>{option.label}{(option.description ?? '').length > 0 ? <span class="text-muted-foreground text-xs">{option.description}</span> : null}</button>)}</div>
    if (options.mode === 'confirm' || options.mode === 'alert') return null
    const label = dialogLabel(options)
    return <div class="grid gap-2"><label for={`${name}-input`}>{label}</label><input id={`${name}-input`} class={inputClasses} type="text" value={value} placeholder={options.placeholder} autoComplete={options.mode === 'otp' ? 'one-time-code' : 'off'} inputMode={options.mode === 'otp' ? 'numeric' : 'text'} maxLength={options.mode === 'otp' ? options.length ?? 6 : undefined} disabled={busy} mix={on('input', (event) => { onInput(event.currentTarget.value) })} />{error ? <p role="alert" class="text-destructive text-sm">{error}</p> : null}</div>
  }
}

function DialogButtons(handle: Handle<ViewProps>) {
  return () => {
    const { options, busy, value, onCancel } = handle.props
    const style = options.variant === 'destructive' ? buttonDefault.replace('bg-primary text-primary-foreground', 'bg-destructive text-white') : buttonDefault
    return <div class="flex justify-end gap-2">{options.mode === 'alert' ? null : <button type="button" disabled={busy} class={`${buttonBase.replace('border-transparent ', '')} ${buttonOutline}`} mix={on('click', onCancel)}>{options.cancelLabel ?? 'Cancel'}</button>}{options.mode === 'choice' ? null : <button type="submit" class={`${buttonBase} ${style}`} disabled={busy || !canSubmitDialog(options, value)}>{confirmLabel(options, busy)}</button>}</div>
  }
}

export function DialogContent(handle: Handle<ViewProps>) {
  return () => <form class="grid gap-6" mix={on('submit', (event) => { event.preventDefault(); handle.props.onSubmit() })}><div class="grid gap-2"><h2 id={`${handle.props.name}-title`} class="font-semibold text-lg">{handle.props.options.title}</h2>{(handle.props.options.description ?? '').length > 0 ? <p id={`${handle.props.name}-description`} class="text-muted-foreground text-sm">{handle.props.options.description}</p> : null}</div><DialogField {...handle.props} /><DialogButtons {...handle.props} /></form>
}



export function DialogRoot(handle: Handle<Omit<ViewProps, 'options'> & { readonly options: DialogOptions | undefined; readonly bind: (node: HTMLDialogElement) => void }>) {
  return () => <dialog class="m-auto w-[calc(100%-2rem)] max-w-lg rounded-xl border border-border bg-card p-6 text-card-foreground shadow-xl backdrop:bg-black/50" aria-labelledby={`${handle.props.name}-title`} aria-describedby={(handle.props.options?.description ?? '').length > 0 ? `${handle.props.name}-description` : undefined} mix={[ref(handle.props.bind), on('cancel', (event) => { event.preventDefault(); if (!handle.props.busy) handle.props.onCancel() })]}>{handle.props.options ? <DialogContent {...handle.props} options={handle.props.options} /> : null}</dialog>
}

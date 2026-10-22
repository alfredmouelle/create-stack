import type { Handle } from 'remix/component'

import { canSubmitDialog, type DialogOptions } from './dialog-options.ts'
import { DialogRoot } from './dialog-view.tsx'

type DialogResult = string | boolean | null | undefined
type Pending = { readonly options: DialogOptions; readonly resolve: (value: DialogResult) => void }
const channels = new Map<string, (pending: Pending) => void>()

export function callDialog(name: string, options: DialogOptions): Promise<DialogResult> {
  const receive = channels.get(name)
  if (!receive) return Promise.reject(new Error(`Mount <${name} /> before calling ${name}.call()`))
  return new Promise((resolve) => { receive({ options, resolve }) })
}

function canceled(mode: DialogOptions['mode'] | undefined): DialogResult {
  if (mode === 'confirm' || mode === 'passphrase' || mode === 'otp') return false
  return mode === 'alert' ? undefined : null
}


async function verify(options: DialogOptions, value: string): Promise<{ readonly ok: true; readonly result: DialogResult } | { readonly ok: false; readonly error: string }> {
  if (options.mode !== 'otp') return { ok: true, result: options.mode === 'prompt' ? value : options.mode === 'alert' ? undefined : true }
  try {
    return await options.verify(value) ? { ok: true, result: true } : { ok: false, error: 'Invalid code. Try again.' }
  } catch {
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
}


async function update(handle: Handle): Promise<void> {
  if (!handle.signal.aborted) await handle.update()
}

function openDialog(dialog: HTMLDialogElement | undefined): void {
  dialog?.showModal()
  const field = dialog?.querySelector('input, button')
  if (field instanceof HTMLElement) field.focus()
}

function cancelQueued(queue: readonly Pending[]): void {
  for (const pending of queue) pending.resolve(canceled(pending.options.mode))
}

export function createDialog(handle: Handle, name: string) {
  const queue: Pending[] = []
  let active: Pending | undefined
  let dialog: HTMLDialogElement | undefined
  let value = ''
  let error = ''
  let busy = false
  let returnFocus: Element | null = null
  const showNext = async (): Promise<void> => {
    if (active || handle.signal.aborted) return
    active = queue.shift()
    if (!active) return
    value = active.options.mode === 'prompt' ? active.options.defaultValue ?? '' : ''
    error = ''
    returnFocus = document.activeElement
    await update(handle)
    openDialog(dialog)
  }
  const finish = (result: DialogResult): void => {
    if (!active) return
    const pending = active
    active = undefined
    dialog?.close()
    pending.resolve(result)
    if (returnFocus instanceof HTMLElement) returnFocus.focus()
    void update(handle).then(showNext)
  }
  const cancel = (): void => { finish(canceled(active?.options.mode)) }
  const receive = (pending: Pending): void => { queue.push(pending); void showNext() }
  handle.queueTask(() => {
    if (channels.has(name)) throw new Error(`Only one <${name} /> can be mounted.`)
    channels.set(name, receive)
    handle.signal.addEventListener('abort', () => { channels.delete(name); cancel(); cancelQueued(queue.splice(0)) }, { once: true })
  })
  const submit = async (): Promise<void> => {
    const options = active?.options
    if (!options || busy || !canSubmitDialog(options, value)) return
    if (options.mode === 'choice') { finish(value); return }
    busy = true
    void update(handle)
    const result = await verify(options, value)
    busy = false
    if (result.ok) finish(result.result)
    else { error = result.error; value = ''; void update(handle) }
  }
  return () => <DialogRoot name={name} options={active?.options} value={value} error={error} busy={busy} bind={(node) => { dialog = node }} onInput={(next) => { value = next; void update(handle) }} onCancel={cancel} onSubmit={() => { void submit() }} />
}

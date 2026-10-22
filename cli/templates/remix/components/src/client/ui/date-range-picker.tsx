import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { DatePicker } from './date-picker.tsx'

export type DateRangeValue = { readonly from: string; readonly to: string }
export type DateRangePickerProps = {
  value: DateRangeValue | null
  onChange: (value: DateRangeValue | null) => void
  disabled?: boolean
}

export function DateRangePicker(handle: Handle<DateRangePickerProps>) {
  let previous = handle.props.value
  let draft = previous ?? { from: '', to: '' }
  const update = (key: 'from' | 'to', value: string): void => {
    draft = { ...draft, [key]: value }
    void handle.update()
  }
  return () => {
    if (previous !== handle.props.value) { previous = handle.props.value; draft = previous ?? { from: '', to: '' } }
    const invalid = !draft.from || !draft.to || draft.from > draft.to
    return <fieldset class="grid gap-3" disabled={handle.props.disabled}><legend class="sr-only">Date range</legend><div class="grid gap-2 sm:grid-cols-2"><DatePicker label="Start date" value={draft.from} max={draft.to} onChange={(value) => { update('from', value) }} /><DatePicker label="End date" value={draft.to} min={draft.from} onChange={(value) => { update('to', value) }} /></div><div class="flex justify-end gap-2"><button type="button" class="cursor-pointer rounded-lg border px-3 py-1.5" mix={on('click', () => { draft = { from: '', to: '' }; handle.props.onChange(null); void handle.update() })}>Clear range</button><button type="button" class="cursor-pointer rounded-lg bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50" disabled={invalid} mix={on('click', () => { if (!invalid) handle.props.onChange({ ...draft }) })}>Apply range</button></div></fieldset>
  }
}

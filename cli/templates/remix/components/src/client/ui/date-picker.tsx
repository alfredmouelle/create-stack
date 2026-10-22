import { on } from 'remix/component'
import type { Handle } from 'remix/component'
import { inputClasses } from '../ui-styles.ts'

export type DatePickerProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  class?: string
  min?: string
  max?: string
  label?: string
}

export function DatePicker(handle: Handle<DatePickerProps>) {
  return () => <div class={`flex items-center gap-2 text-muted-foreground ${handle.props.class ?? ''}`}><input aria-label={handle.props.label ?? handle.props.placeholder ?? 'Pick a date'} type="date" class={inputClasses} value={handle.props.value} min={handle.props.min} max={handle.props.max} disabled={handle.props.disabled} mix={on('change', (event) => { handle.props.onChange(event.currentTarget.value) })} /><button aria-label="Clear date" type="button" class="cursor-pointer px-2 hover:text-destructive disabled:opacity-50" disabled={(handle.props.disabled ?? false) || !handle.props.value} mix={on('click', () => { handle.props.onChange('') })}>×</button></div>
}

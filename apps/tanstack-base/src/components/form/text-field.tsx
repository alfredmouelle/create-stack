import type { AnyFieldApi } from '@tanstack/react-form'
import type { ChangeEvent, ComponentProps, ReactNode } from 'react'
import { Input } from '~/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '~/components/ui/input-group'
import { Label } from '~/components/ui/label'
import { FieldError, hasFieldError } from './field-error'

type NativeInputProps = Pick<
  ComponentProps<'input'>,
  'type' | 'placeholder' | 'autoComplete' | 'inputMode' | 'min' | 'max' | 'step'
>

interface TextFieldProps extends NativeInputProps {
  field: AnyFieldApi
  label: string
  description?: string
  /** Optional leading adornment (e.g. a lucide icon). */
  icon?: ReactNode
}

export function TextField({ field, label, description, icon, ...inputProps }: TextFieldProps) {
  const shared = {
    'aria-invalid': hasFieldError(field),
    id: field.name,
    name: field.name,
    onBlur: field.handleBlur,
    onChange: (e: ChangeEvent<HTMLInputElement>) => field.handleChange(e.target.value),
    value: String(field.state.value ?? ''),
    ...inputProps,
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={field.name}>{label}</Label>
      {icon ? (
        <InputGroup className="h-10">
          <InputGroupAddon align="inline-start">{icon}</InputGroupAddon>
          <InputGroupInput {...shared} />
        </InputGroup>
      ) : (
        <Input className="h-10" {...shared} />
      )}
      <FieldError field={field} />
      {description ? <p className="text-muted-foreground text-xs">{description}</p> : null}
    </div>
  )
}

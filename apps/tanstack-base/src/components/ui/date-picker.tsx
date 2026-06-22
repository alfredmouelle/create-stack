import { format, isValid, parseISO } from 'date-fns'
import { CalendarIcon, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { toISODate } from '~/lib/date'
import { cn } from '~/lib/utils'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled,
  className,
}: DatePickerProps) {
  const [open, setOpen] = useState(false)
  const parsed = value ? parseISO(value) : undefined
  const date = parsed && isValid(parsed) ? parsed : undefined

  const clear = () => {
    onChange('')
    setOpen(false)
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <div className={cn('group relative w-full', className)}>
        <PopoverTrigger asChild>
          <Button
            className={cn(
              'w-full cursor-pointer justify-start px-3 text-left font-normal',
              !date && 'text-muted-foreground',
            )}
            disabled={disabled}
            variant="outline"
          >
            <CalendarIcon
              className={cn(
                'mr-2 size-4 opacity-50 transition-opacity',
                date && !disabled && 'group-hover:opacity-0',
              )}
            />
            {date ? format(date, 'PPP') : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>

        {date && !disabled && (
          <button
            aria-label="Clear date"
            className="absolute top-1/2 left-3 z-10 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            onClick={clear}
            type="button"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          autoFocus
          mode="single"
          onSelect={(selected) => {
            if (selected) {
              onChange(toISODate(selected))
              setOpen(false)
            }
          }}
          selected={date}
        />
      </PopoverContent>
    </Popover>
  )
}

import { format, parseISO } from 'date-fns'
import { CalendarRange, X } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { Button } from '~/components/ui/button'
import { Calendar } from '~/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover'
import { toISODate } from '~/lib/date'
import { cn } from '~/lib/utils'

export interface DateRangeValue {
  from: string
  to: string
}

interface DateRangePickerProps {
  value: DateRangeValue | null
  onChange: (value: DateRangeValue | null) => void
  placeholder?: string
  numberOfMonths?: number
  align?: ComponentProps<typeof PopoverContent>['align']
  triggerVariant?: ComponentProps<typeof Button>['variant']
  triggerClassName?: string
  formatLabel?: (value: DateRangeValue) => string
}

const defaultFormatLabel = (value: DateRangeValue) =>
  `${format(parseISO(value.from), 'd MMM')} – ${format(parseISO(value.to), 'd MMM')}`

export function DateRangePicker({
  value,
  onChange,
  placeholder = 'Plage de dates',
  numberOfMonths = 2,
  align = 'end',
  triggerVariant = 'outline',
  triggerClassName,
  formatLabel = defaultFormatLabel,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const hasValue = value !== null

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(value ? { from: parseISO(value.from), to: parseISO(value.to) } : undefined)
    }
    setOpen(next)
  }

  const applyDraft = () => {
    if (!(draft?.from && draft.to)) return
    onChange({
      from: toISODate(draft.from),
      to: toISODate(draft.to),
    })
    setOpen(false)
  }

  const reset = () => {
    setDraft(undefined)
    onChange(null)
    setOpen(false)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <div className="group relative inline-flex shrink-0">
        <PopoverTrigger asChild>
          <Button
            className={cn('cursor-pointer', triggerClassName)}
            size="sm"
            variant={hasValue ? 'secondary' : triggerVariant}
          >
            <CalendarRange
              className={cn('transition-opacity', hasValue && 'group-hover:opacity-0')}
            />
            {hasValue ? formatLabel(value) : placeholder}
          </Button>
        </PopoverTrigger>

        {hasValue && (
          <button
            aria-label="Clear range"
            className="absolute top-1/2 left-3 z-10 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              reset()
            }}
            type="button"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <PopoverContent align={align} className="w-auto p-0">
        <Calendar
          autoFocus
          mode="range"
          numberOfMonths={numberOfMonths}
          onSelect={setDraft}
          selected={draft}
        />
        <div className="flex items-center justify-between gap-2 border-t p-2">
          <Button
            className="cursor-pointer"
            disabled={!(hasValue || draft?.from)}
            onClick={reset}
            size="sm"
            variant="ghost"
          >
            Réinitialiser
          </Button>
          <div className="flex gap-2">
            <Button
              className="cursor-pointer"
              onClick={() => setOpen(false)}
              size="sm"
              variant="ghost"
            >
              Annuler
            </Button>
            <Button
              className="cursor-pointer"
              disabled={!(draft?.from && draft.to)}
              onClick={applyDraft}
              size="sm"
            >
              Appliquer
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

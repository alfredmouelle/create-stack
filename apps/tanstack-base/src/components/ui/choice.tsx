'use client'

import { createCallable } from 'react-call'

import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

export interface ChoiceOption {
  label: string
  value: string
  description?: string
}

export interface ChoiceProps {
  title: string
  description?: string
  options: ChoiceOption[]
}

export const Choice = createCallable<ChoiceProps, string | null>(
  ({ call, title, description, options }) => (
    <Dialog open={!call.ended} onOpenChange={(open) => !open && call.end(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="grid gap-2">
          {options.map((option) => (
            <Button
              key={option.value}
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 whitespace-normal py-2.5 text-left"
              onClick={() => call.end(option.value)}
            >
              <span className="font-medium">{option.label}</span>
              {option.description && (
                <span className="text-muted-foreground text-xs">{option.description}</span>
              )}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  ),
  200,
)

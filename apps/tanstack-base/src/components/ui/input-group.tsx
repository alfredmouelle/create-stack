import { cva, type VariantProps } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

function InputGroup({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'group/input-group relative flex h-9 w-full min-w-0 items-center rounded-4xl border border-transparent bg-input/50 outline-none transition-[color,box-shadow,background-color] has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/30 has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=inline-end]]:[&>input]:pr-1.5 has-[>[data-align=inline-start]]:[&>input]:pl-1.5',
        className,
      )}
      data-slot="input-group"
      role="group"
      {...props}
    />
  )
}

const inputGroupAddonVariants = cva(
  "flex h-auto cursor-text select-none items-center justify-center gap-2 py-2 font-medium text-muted-foreground text-sm group-data-[disabled=true]/input-group:opacity-50 [&>svg:not([class*='size-'])]:size-4",
  {
    variants: {
      align: {
        'inline-start': 'order-first pl-3 has-[>button]:-ml-1',
        'inline-end': 'order-last pr-3 has-[>button]:-mr-1',
      },
    },
    defaultVariants: {
      align: 'inline-start',
    },
  },
)

function InputGroupAddon({
  className,
  align = 'inline-start',
  ...props
}: ComponentProps<'div'> & VariantProps<typeof inputGroupAddonVariants>) {
  return (
    <div
      className={cn(inputGroupAddonVariants({ align }), className)}
      data-align={align}
      data-slot="input-group-addon"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        e.currentTarget.parentElement?.querySelector('input')?.focus()
      }}
      role="group"
      {...props}
    />
  )
}

function InputGroupText({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        "flex items-center gap-2 text-muted-foreground text-sm [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      )}
      {...props}
    />
  )
}

function InputGroupInput({ className, ...props }: ComponentProps<'input'>) {
  return (
    <Input
      className={cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent',
        className,
      )}
      data-slot="input-group-control"
      {...props}
    />
  )
}

function InputGroupButton({
  className,
  type = 'button',
  variant = 'ghost',
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn('flex items-center gap-2 rounded-4xl text-sm shadow-none', className)}
      type={type}
      variant={variant}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput, InputGroupText }

import { Loader2 } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '~/lib/utils'

/** Loading indicator — the lucide `loader` icon, spinning. */
export function Spinner({ className, ...props }: ComponentProps<typeof Loader2>) {
  return <Loader2 aria-hidden="true" className={cn('size-4 animate-spin', className)} {...props} />
}

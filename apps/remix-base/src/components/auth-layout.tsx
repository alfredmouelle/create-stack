import type { Handle, RemixNode } from 'remix/component'
import { cn } from '../lib/utils.ts'
import { AuthBrand } from './auth-brand.tsx'

export function AuthLayout(handle: Handle<{ children: RemixNode }>) {
  return () => (
    <div class="min-h-svh bg-background p-4 sm:p-6 lg:p-10">
      <div class="mx-auto grid max-w-6xl overflow-hidden rounded-[12px] border border-border bg-card lg:min-h-[calc(100svh-5rem)] lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)]">
        <main class="order-1 flex items-center justify-center p-2 sm:p-8 lg:order-2 lg:p-12">
          <div class="w-full max-w-sm">{handle.props.children}</div>
        </main>
        <AuthBrand />
      </div>
    </div>
  )
}

export function AuthCard(
  handle: Handle<{ title: string; description: RemixNode; children: RemixNode; footer: RemixNode }>,
) {
  return () => (
    <div
      class={cn(
        'group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-4xl bg-card py-(--card-spacing) text-card-foreground text-sm ring-1 ring-foreground/5 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 dark:ring-foreground/10 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-4xl *:[img:last-child]:rounded-b-4xl',
        'gap-0 rounded-none bg-card py-0 shadow-none ring-0',
      )}
      data-size="default"
      data-slot="card"
    >
      <div
        class={cn(
          'group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-4xl px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)',
          'px-8 pt-9 pb-0',
        )}
        data-slot="card-header"
      >
        <div
          class="font-heading font-semibold font-stretch-92% text-3xl tracking-[-0.035em]"
          data-slot="card-title"
        >
          {handle.props.title}
        </div>
        <div
          class="pt-1 text-muted-foreground text-sm leading-relaxed"
          data-slot="card-description"
        >
          {handle.props.description}
        </div>
      </div>
      <div class="px-8 pt-7 pb-8" data-slot="card-content">
        {handle.props.children}
      </div>
      <div class="border-border border-t px-8 py-5 text-center text-muted-foreground text-sm">
        {handle.props.footer}
      </div>
    </div>
  )
}

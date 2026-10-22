import type { Handle } from 'remix/component'
import { clientEntry, on, ref } from 'remix/component'
import { buttonBase } from './ui-styles.ts'

const THEMES = ['light', 'dark', 'system'] as const
type Theme = (typeof THEMES)[number]

function Icon(handle: Handle<{ kind: Theme; class?: string }>) {
  return () => (
    <svg
      aria-hidden="true"
      class={handle.props.class ?? 'size-4'}
      fill="none"
      height="24"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
    >
      {handle.props.kind === 'light' ? (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
        </>
      ) : null}
      {handle.props.kind === 'dark' ? (
        <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6.25 6.25 0 0 0 8.268 8.268c.344-.215.825-.004.803.401" />
      ) : null}
      {handle.props.kind === 'system' ? (
        <>
          <rect height="14" rx="2" width="20" x="2" y="3" />
          <path d="M8 21h8m-4-4v4" />
        </>
      ) : null}
    </svg>
  )
}

function menuIndex(key: string, current: number, count: number): number | undefined {
  switch (key) {
    case 'Home':
      return 0
    case 'End':
      return count - 1
    case 'ArrowDown':
      return (current + 1) % count
    case 'ArrowUp':
      return (current + count - 1) % count
    default:
      return undefined
  }
}

function moveMenuFocus(event: KeyboardEvent, root: HTMLElement): boolean {
  if (
    !(event.target instanceof HTMLButtonElement) ||
    event.target.getAttribute('role') !== 'menuitem'
  )
    return false
  const items = [...root.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]')]
  const index = menuIndex(event.key, items.indexOf(event.target), items.length)
  if (index === undefined) return false
  event.preventDefault()
  items[index]?.focus()
  return true
}

function focusTrigger(root: HTMLElement): void {
  root.querySelector('button')?.focus()
}

function ThemeMenu(handle: Handle<{ readonly choose: (value: Theme) => void }>) {
  return () => (
    <div
      class="absolute top-full right-0 z-50 mt-1 min-w-32 overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md"
      role="menu"
    >
      {THEMES.map((value) => (
        <button
          class="relative flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm outline-none hover:bg-accent focus:bg-accent"
          key={value}
          mix={on('click', () => {
            handle.props.choose(value)
          })}
          role="menuitem"
          type="button"
        >
          <Icon kind={value} />
          {value[0]?.toUpperCase()}
          {value.slice(1)}
        </button>
      ))}
    </div>
  )
}

export const ThemeToggle = clientEntry(import.meta.url, function ThemeToggle(handle: Handle) {
  let theme: Theme = 'system'
  let open = false
  let root: HTMLElement | undefined
  const apply = (): void => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' ||
        (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches),
    )
  }
  handle.queueTask(() => {
    try {
      const stored = localStorage.getItem('theme')
      const selected = THEMES.find((value) => value === stored)
      if (selected !== undefined) theme = selected
    } catch {}
    apply()
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply, {
      signal: handle.signal,
    })
    document.addEventListener(
      'click',
      (event) => {
        if (open && event.target instanceof Node && root?.contains(event.target) !== true) {
          open = false
          void handle.update()
        }
      },
      { signal: handle.signal },
    )
  })
  const choose = (value: Theme): void => {
    theme = value
    try {
      localStorage.setItem('theme', value)
    } catch {}
    apply()
    open = false
    void handle.update().then(() => root?.querySelector('button')?.focus())
  }
  const handleMenuKey = async (event: KeyboardEvent): Promise<void> => {
    const container = root
    if (!container) return
    if (moveMenuFocus(event, container)) return
    if (event.key !== 'Escape' && event.key !== 'Tab') return
    open = false
    if (event.key === 'Escape') event.preventDefault()
    await handle.update()
    if (event.key === 'Escape') focusTrigger(container)
  }
  return () => (
    <div
      class="relative"
      mix={[
        ref((node) => {
          root = node
        }),
        on<HTMLDivElement, 'keydown'>('keydown', handleMenuKey),
      ]}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Toggle theme"
        class={`${buttonBase} size-9 hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50`}
        data-size="icon"
        data-slot="button"
        data-variant="ghost"
        mix={[
          on('click', () => {
            open = !open
            void handle.update()
          }),
          on('keydown', async (event) => {
            if (event.key === 'Escape') {
              open = false
              await handle.update()
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              open = true
              await handle.update()
              root?.querySelector('[role="menuitem"]')?.scrollIntoView({ block: 'nearest' })
              const item = root?.querySelector('button[role="menuitem"]')
              if (item instanceof HTMLButtonElement) item.focus()
            }
          }),
        ]}
        type="button"
      >
        <Icon class="size-4 dark:hidden" kind="light" />
        <Icon class="hidden size-4 dark:block" kind="dark" />
      </button>
      {open ? <ThemeMenu choose={choose} /> : null}
    </div>
  )
})

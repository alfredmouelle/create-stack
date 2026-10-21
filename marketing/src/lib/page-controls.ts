export const THEME_STORAGE_KEY = 'create-stack.theme'

export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'

const LONG_PRESS_MS = 500

export function nextTheme(current: Theme): Theme {
  return current === 'dark' ? 'light' : 'dark'
}

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system'
}

function currentTheme(root: HTMLElement): Theme {
  const explicit = root.dataset.theme
  if (explicit === 'light' || explicit === 'dark') return explicit
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function currentPreference(root: HTMLElement): ThemePreference {
  const explicit = root.dataset.theme
  return explicit === 'light' || explicit === 'dark' ? explicit : 'system'
}

function syncThemeChoices(preference: ThemePreference) {
  for (const choice of document.querySelectorAll<HTMLElement>('[data-theme-choice]')) {
    const selected = String(choice.dataset.themeChoice === preference)
    if (choice.getAttribute('role') === 'menuitemradio')
      choice.setAttribute('aria-checked', selected)
    else choice.setAttribute('aria-pressed', selected)
  }
}

function applyPreference(preference: ThemePreference) {
  const root = document.documentElement
  if (preference === 'system') delete root.dataset.theme
  else root.dataset.theme = preference
  syncThemeChoices(preference)
  try {
    if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    return
  }
}

function setupThemeMenu() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-theme-toggle]')
  const menu = document.querySelector<HTMLElement>('[data-theme-menu]')
  if (!toggle || !menu) return
  const items = [...menu.querySelectorAll<HTMLButtonElement>('[data-theme-choice]')]
  let pressTimer = 0
  let suppressClick = false

  function isOpen() {
    return !menu?.hidden
  }

  function close(restoreFocus: boolean) {
    if (!menu || menu.hidden) return
    menu.hidden = true
    toggle?.setAttribute('aria-expanded', 'false')
    if (restoreFocus) toggle?.focus()
  }

  function open() {
    if (!menu) return
    menu.hidden = false
    toggle?.setAttribute('aria-expanded', 'true')
    const preference = currentPreference(document.documentElement)
    const checked = items.find((item) => item.dataset.themeChoice === preference) ?? items[0]
    checked?.focus()
  }

  function clearPress() {
    window.clearTimeout(pressTimer)
    pressTimer = 0
  }

  toggle.addEventListener('click', (event) => {
    event.preventDefault()
    if (suppressClick) {
      suppressClick = false
      return
    }
    close(false)
    applyPreference(nextTheme(currentTheme(document.documentElement)))
  })

  toggle.addEventListener('contextmenu', (event) => {
    event.preventDefault()
    clearPress()
    if (suppressClick && isOpen()) return
    if (isOpen()) close(true)
    else open()
  })

  toggle.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse') return
    clearPress()
    pressTimer = window.setTimeout(() => {
      pressTimer = 0
      suppressClick = true
      open()
    }, LONG_PRESS_MS)
  })

  for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
    toggle.addEventListener(type, clearPress)
  }

  menu.addEventListener('keydown', (event) => {
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const focusAt = (next: number) => items.at(next % items.length)?.focus()
    if (event.key === 'ArrowDown') focusAt(index + 1)
    else if (event.key === 'ArrowUp') focusAt(index - 1)
    else if (event.key === 'Home') focusAt(0)
    else if (event.key === 'End') focusAt(-1)
    else if (event.key === 'Escape') close(true)
    else if (event.key === 'Tab') close(false)
    else return
    event.preventDefault()
  })

  document.addEventListener('pointerdown', (event) => {
    if (
      event.target instanceof Node &&
      (menu.contains(event.target) || toggle.contains(event.target))
    )
      return
    close(false)
  })

  menu.addEventListener('click', (event) => {
    if (event.target instanceof Element && event.target.closest('[data-theme-choice]')) close(true)
  })
}

async function copyFrom(button: HTMLButtonElement, text: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable')
    await navigator.clipboard.writeText(text)
    button.textContent = 'Copied ✓'
    button.dataset.state = 'copied'
    window.setTimeout(() => {
      button.textContent = 'Copy'
      delete button.dataset.state
    }, 1600)
  } catch {
    const code = button.parentElement?.querySelector('code')
    if (code) window.getSelection()?.selectAllChildren(code)
  }
}

export function setupPageControls() {
  syncThemeChoices(currentPreference(document.documentElement))
  setupThemeMenu()
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return

    const choice = event.target.closest<HTMLElement>('[data-theme-choice]')?.dataset.themeChoice
    if (isThemePreference(choice)) {
      applyPreference(choice)
      return
    }

    const copyButton = event.target.closest<HTMLButtonElement>('button[data-copy]')
    const text = copyButton?.dataset.copy
    if (copyButton && text) void copyFrom(copyButton, text)
  })
}

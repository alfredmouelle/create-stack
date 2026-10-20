import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react'

export type Theme = 'dark' | 'light' | 'system'

export const THEME_STORAGE_KEY = 'theme'

type ThemeProviderState = {
  readonly theme: Theme
  readonly setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null)

function storedTheme(defaultTheme: Theme): Theme {
  const value = localStorage.getItem(THEME_STORAGE_KEY)
  return value === 'dark' || value === 'light' || value === 'system' ? value : defaultTheme
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('storage', onChange)
  window.addEventListener('theme-change', onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener('theme-change', onChange)
  }
}

function setTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  window.dispatchEvent(new Event('theme-change'))
}

const applyTheme = (theme: Theme): void => {
  const root = document.documentElement
  const resolved =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
}: {
  readonly children: ReactNode
  readonly defaultTheme?: Theme
}) {
  const theme = useSyncExternalStore(
    subscribe,
    () => storedTheme(defaultTheme),
    () => defaultTheme,
  )
  const value = useMemo(() => ({ theme, setTheme }), [theme])

  useEffect(() => {
    applyTheme(theme)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      applyTheme('system')
    }
    if (theme === 'system') media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [theme])

  return <ThemeProviderContext.Provider value={value}>{children}</ThemeProviderContext.Provider>
}

export function useTheme(): ThemeProviderState {
  const context = useContext(ThemeProviderContext)
  if (!context) throw new Error('useTheme must be used within a ThemeProvider')
  return context
}

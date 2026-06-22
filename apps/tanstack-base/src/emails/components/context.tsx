import { createContext, useContext } from 'react'
import { defaultTheme, type EmailTheme } from './theme'

const EmailThemeContext = createContext<EmailTheme>(defaultTheme)

export interface EmailThemeProviderProps {
  theme: EmailTheme
  children: React.ReactNode
}

export function EmailThemeProvider({ theme, children }: EmailThemeProviderProps) {
  return <EmailThemeContext.Provider value={theme}>{children}</EmailThemeContext.Provider>
}

/** Read the active email theme. Falls back to {@link defaultTheme}. */
export function useEmailTheme(): EmailTheme {
  return useContext(EmailThemeContext)
}

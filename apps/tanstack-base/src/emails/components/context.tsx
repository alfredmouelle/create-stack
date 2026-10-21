import { createContext, useContext } from 'react'
import { defaultTheme, type EmailTheme } from './theme'

const EmailThemeContext = createContext<EmailTheme>(defaultTheme)

export interface EmailThemeProviderProps {
  readonly theme: EmailTheme
  readonly children: React.ReactNode
}

export function EmailThemeProvider({ theme, children }: EmailThemeProviderProps) {
  return <EmailThemeContext.Provider value={theme}>{children}</EmailThemeContext.Provider>
}

export function useEmailTheme(): EmailTheme {
  return useContext(EmailThemeContext)
}

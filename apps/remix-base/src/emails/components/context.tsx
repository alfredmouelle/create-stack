'use client'

import { createContext, createElement, useContext } from 'react'
import { defaultTheme, type EmailTheme } from './theme'

const EmailThemeContext = createContext<EmailTheme>(defaultTheme)
export type EmailThemeProviderProps = {
  readonly theme: EmailTheme
  readonly children?: React.ReactNode
}
export function EmailThemeProvider({ theme, children }: EmailThemeProviderProps) {
  return createElement(
    EmailThemeContext.Provider,
    {
      value: theme,
    },
    children,
  )
}
export function useEmailTheme(): EmailTheme {
  return useContext(EmailThemeContext)
}

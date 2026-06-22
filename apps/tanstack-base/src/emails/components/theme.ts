/**
 * Swappable email design tokens. Override a subset via {@link createEmailTheme}
 * + `<EmailLayout theme={...}>`, or wrap a tree in `<EmailThemeProvider>`.
 */
export interface EmailTheme {
  brand: {
    /** Header band + footer. */
    name: string
    /** Footer line (year prefixed automatically). */
    footer: string
  }
  fontFamily: string
  colors: {
    pageBg: string
    cardBg: string
    fg: string
    fgStrong: string
    fgMuted: string
    fgFaint: string
    border: string
    borderSubtle: string
    destructive: string
    /** Text over accent/destructive buttons. */
    onAccent: string
  }
}

export const defaultTheme: EmailTheme = {
  brand: {
    name: 'ACME',
    footer: 'ACME · All rights reserved.',
  },
  fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  colors: {
    pageBg: '#f4f4f5',
    cardBg: '#ffffff',
    fg: '#18181b',
    fgStrong: '#09090b',
    fgMuted: '#71717a',
    fgFaint: '#a1a1aa',
    border: '#e4e4e7',
    borderSubtle: '#f4f4f5',
    destructive: '#dc2626',
    onAccent: '#ffffff',
  },
}

export type EmailThemeOverride = {
  brand?: Partial<EmailTheme['brand']>
  fontFamily?: string
  colors?: Partial<EmailTheme['colors']>
}

/** Deep-merge override onto base (defaults to {@link defaultTheme}). */
export function createEmailTheme(
  override: EmailThemeOverride = {},
  base: EmailTheme = defaultTheme,
): EmailTheme {
  return {
    brand: { ...base.brand, ...override.brand },
    fontFamily: override.fontFamily ?? base.fontFamily,
    colors: { ...base.colors, ...override.colors },
  }
}

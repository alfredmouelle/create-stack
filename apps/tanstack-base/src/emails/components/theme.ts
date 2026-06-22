/**
 * The swappable design tokens for emails. Override any subset via
 * {@link createEmailTheme} and pass the result to `<EmailLayout theme={...}>`,
 * or wrap a tree in `<EmailThemeProvider>`.
 */
export interface EmailTheme {
  brand: {
    /** Shown in the header band and footer. */
    name: string
    /** Footer line (the year is prefixed automatically). */
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
    /** Text color on top of accent/destructive buttons. */
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

/** Deep-merge an override onto a base theme (defaults to {@link defaultTheme}). */
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

export interface EmailTheme {
  brand: {
    name: string
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
    primary?: string
    destructive: string
    onAccent: string
  }
}

export const defaultTheme: EmailTheme = {
  brand: {
    name: 'create-stack',
    footer: 'create-stack · made for the first useful commit.',
  },
  fontFamily: "'Instrument Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  colors: {
    pageBg: '#f6f7f6',
    cardBg: '#ffffff',
    fg: '#0b0d0c',
    fgStrong: '#0b0d0c',
    fgMuted: '#5c625e',
    fgFaint: '#6b716d',
    border: '#dde0dd',
    borderSubtle: '#eceeec',
    primary: '#1a7f37',
    destructive: '#b3311a',
    onAccent: '#ffffff',
  },
}

export type EmailThemeOverride = {
  brand?: Partial<EmailTheme['brand']>
  fontFamily?: string
  colors?: Partial<EmailTheme['colors']>
}

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

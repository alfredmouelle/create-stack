import { siteConfig } from '~/lib/site-config'

export interface EmailTheme {
  readonly brand: {
    readonly name: string
    readonly footer: string
  }
  readonly fontFamily: string
  readonly colors: {
    readonly pageBg: string
    readonly cardBg: string
    readonly fg: string
    readonly fgStrong: string
    readonly fgMuted: string
    readonly fgFaint: string
    readonly border: string
    readonly borderSubtle: string
    readonly primary?: string
    readonly destructive: string
    readonly onAccent: string
  }
}

export const defaultTheme: EmailTheme = {
  brand: {
    name: siteConfig.name,
    footer: siteConfig.description,
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
  readonly brand?: Partial<EmailTheme['brand']>
  readonly fontFamily?: string
  readonly colors?: Partial<EmailTheme['colors']>
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

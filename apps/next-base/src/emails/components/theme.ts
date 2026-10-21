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
    name: 'create-stack',
    footer: 'create-stack · made for the first useful commit.',
  },
  fontFamily: "'Geist Variable', Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  colors: {
    pageBg: '#edf2ef',
    cardBg: '#f9fbf9',
    fg: '#14211f',
    fgStrong: '#14211f',
    fgMuted: '#53635e',
    fgFaint: '#647470',
    border: '#cbd8d3',
    borderSubtle: '#e2ebe7',
    primary: '#1858d1',
    destructive: '#b42318',
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

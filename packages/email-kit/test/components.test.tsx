import { render } from 'react-email'
import { describe, expect, it } from 'vitest'
import {
  EmailBodyText,
  EmailButton,
  EmailFallback,
  EmailHeading,
  EmailLayout,
} from '../src/components.js'
import type { EmailThemeOverride } from '../src/theme.js'
import { createEmailTheme, defaultTheme } from '../src/theme.js'

function SampleEmail({ theme }: { theme?: EmailThemeOverride }) {
  return (
    <EmailLayout preview="A preview line" theme={theme} year={2026}>
      <EmailHeading kicker="Confirmation">Confirm your address.</EmailHeading>
      <EmailBodyText>Click the button below to verify your email.</EmailBodyText>
      <EmailButton href="https://app.test/verify">Verify →</EmailButton>
      <EmailFallback url="https://app.test/verify" />
    </EmailLayout>
  )
}

describe('email-kit components', () => {
  it('renders the brand, preview and footer year', async () => {
    const html = await render(<SampleEmail />)
    expect(html).toContain(defaultTheme.brand.name)
    expect(html).toContain('A preview line')
    expect(html).toContain('2026')
    expect(html).toContain(defaultTheme.brand.footer)
    expect(html).toContain('https://app.test/verify')
  })

  it('applies the default theme colors', async () => {
    const html = await render(<SampleEmail />)
    expect(html).toContain(defaultTheme.colors.pageBg)
    expect(html).toContain(defaultTheme.colors.fgStrong)
  })

  it('lets a theme override swap colors and brand without touching templates', async () => {
    const override: EmailThemeOverride = {
      brand: { name: 'NEON' },
      colors: { pageBg: '#000000', fgStrong: '#00ff88' },
    }
    const html = await render(<SampleEmail theme={override} />)

    expect(html).toContain('NEON')
    expect(html).toContain('#000000')
    expect(html).toContain('#00ff88')
  })

  it('createEmailTheme deep-merges onto the default theme', () => {
    const theme = createEmailTheme({ colors: { destructive: '#ff0000' } })
    expect(theme.colors.destructive).toBe('#ff0000')
    expect(theme.colors.pageBg).toBe(defaultTheme.colors.pageBg)
    expect(theme.brand.name).toBe(defaultTheme.brand.name)
  })
})

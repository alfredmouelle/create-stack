import { Body, Container, Head, Html, Link, Preview, Section, Tailwind, Text } from 'react-email'
import { EmailThemeProvider, useEmailTheme } from './context'
import { createEmailTheme, type EmailTheme, type EmailThemeOverride } from './theme'

export interface EmailLayoutProps {
  preview: string
  children: React.ReactNode
  /** Per-email theme override, merged onto the default theme. */
  theme?: EmailTheme | EmailThemeOverride
  /** Footer year. Pass explicitly to keep rendered output deterministic. */
  year?: number
}

function resolveTheme(theme: EmailLayoutProps['theme']): EmailTheme {
  if (!theme) return createEmailTheme()
  if ('colors' in theme && 'brand' in theme && 'fontFamily' in theme) {
    return theme as EmailTheme
  }
  return createEmailTheme(theme as EmailThemeOverride)
}

export function EmailLayout({ preview, children, theme, year }: EmailLayoutProps) {
  const resolved = resolveTheme(theme)
  const { colors, brand, fontFamily } = resolved
  const footerYear = year ?? new Date().getFullYear()

  return (
    <EmailThemeProvider theme={resolved}>
      <Html lang="en">
        <Head />
        <Preview>{preview}</Preview>
        <Tailwind>
          <Body style={{ backgroundColor: colors.pageBg, fontFamily, margin: 0, padding: 0 }}>
            <Container
              style={{
                backgroundColor: colors.cardBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 16,
                margin: '40px auto',
                maxWidth: 520,
                padding: 0,
              }}
            >
              <Section
                style={{ borderBottom: `1px solid ${colors.borderSubtle}`, padding: '20px 36px' }}
              >
                <Text
                  style={{
                    color: colors.fgStrong,
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: '0.3em',
                    margin: 0,
                  }}
                >
                  {brand.name}
                </Text>
              </Section>

              <Section style={{ padding: '32px 36px 28px' }}>{children}</Section>

              <Section
                style={{ borderTop: `1px solid ${colors.borderSubtle}`, padding: '20px 36px 24px' }}
              >
                <Text style={{ color: colors.fgFaint, fontSize: 11, margin: 0 }}>
                  © {footerYear} {brand.footer}
                </Text>
              </Section>
            </Container>
          </Body>
        </Tailwind>
      </Html>
    </EmailThemeProvider>
  )
}

export interface EmailHeadingProps {
  children: React.ReactNode
  kicker?: string
}

export function EmailHeading({ children, kicker }: EmailHeadingProps) {
  const { colors } = useEmailTheme()
  return (
    <>
      {kicker && (
        <Text
          style={{
            color: colors.fgMuted,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.18em',
            margin: '0 0 12px',
            textTransform: 'uppercase',
          }}
        >
          {kicker}
        </Text>
      )}
      <Text
        style={{
          color: colors.fgStrong,
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: '1.15',
          margin: 0,
        }}
      >
        {children}
      </Text>
    </>
  )
}

export interface EmailBodyTextProps {
  children: React.ReactNode
  muted?: boolean
  size?: 'sm' | 'base'
  style?: React.CSSProperties
}

export function EmailBodyText({ children, muted, size = 'base', style }: EmailBodyTextProps) {
  const { colors } = useEmailTheme()
  return (
    <Text
      style={{
        color: muted ? colors.fgMuted : colors.fg,
        fontSize: size === 'sm' ? 14 : 15,
        lineHeight: size === 'sm' ? '22px' : '24px',
        margin: '14px 0 0',
        ...style,
      }}
    >
      {children}
    </Text>
  )
}

export interface EmailButtonProps {
  href: string
  children: React.ReactNode
  variant?: 'primary' | 'destructive'
}

export function EmailButton({ href, children, variant = 'primary' }: EmailButtonProps) {
  const { colors } = useEmailTheme()
  const backgroundColor = variant === 'destructive' ? colors.destructive : colors.fgStrong

  return (
    <Section style={{ margin: '28px 0 0' }}>
      <Link
        href={href}
        style={{
          backgroundColor,
          borderRadius: 10,
          color: colors.onAccent,
          display: 'inline-block',
          fontSize: 14,
          fontWeight: 500,
          padding: '12px 24px',
          textDecoration: 'none',
        }}
      >
        {children}
      </Link>
    </Section>
  )
}

export interface EmailFallbackProps {
  url: string
  label?: string
}

export function EmailFallback({
  url,
  label = 'If the button does not work, copy this link:',
}: EmailFallbackProps) {
  const { colors } = useEmailTheme()
  return (
    <Section style={{ margin: '32px 0 0' }}>
      <Text style={{ color: colors.fgMuted, fontSize: 12, margin: '0 0 6px' }}>{label}</Text>
      <Link
        href={url}
        style={{
          color: colors.fg,
          fontSize: 12,
          overflowWrap: 'anywhere',
          textDecoration: 'underline',
          textUnderlineOffset: 2,
          wordBreak: 'break-all',
        }}
      >
        {url}
      </Link>
    </Section>
  )
}

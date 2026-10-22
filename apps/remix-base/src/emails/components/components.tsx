'use client'

import { createElement, Fragment, useState } from 'react'
import { jsx } from 'react/jsx-runtime'
import { Body, Container, Head, Html, Link, Preview, Section, Text } from 'react-email'
import { EmailThemeProvider, useEmailTheme } from './context'
import { createEmailTheme, type EmailTheme, type EmailThemeOverride } from './theme'
export type EmailLayoutProps = {
  readonly preview: string
  readonly children?: React.ReactNode
  readonly theme?: EmailTheme | EmailThemeOverride
  readonly year?: number
}
export function EmailLayout({ preview, children, theme, year }: EmailLayoutProps) {
  const resolved = createEmailTheme(theme)
  const { colors, brand, fontFamily } = resolved
  const [currentYear] = useState(() => new Date().getFullYear())
  const footerYear = year ?? currentYear
  return createElement(
    EmailThemeProvider,
    {
      theme: resolved,
    },
    createElement(
      Html,
      {
        lang: 'en',
      },
      createElement(Head, null),
      jsx(Preview, { children: preview }),
      createElement(
        Body,
        {
          style: {
            backgroundColor: colors.pageBg,
            fontFamily,
            margin: 0,
            padding: 0,
          },
        },
        createElement(
          Container,
          {
            style: {
              backgroundColor: colors.cardBg,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              margin: '40px auto',
              maxWidth: 520,
              padding: 0,
            },
          },
          createElement(
            Section,
            {
              style: {
                borderBottom: `1px solid ${colors.borderSubtle}`,
                padding: '20px 36px',
              },
            },
            createElement(
              Text,
              {
                style: {
                  color: colors.primary ?? colors.fgStrong,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  margin: 0,
                },
              },
              '>_ ',
              brand.name,
            ),
          ),
          createElement(
            Section,
            {
              style: {
                padding: '32px 36px 28px',
              },
            },
            children,
          ),
          createElement(
            Section,
            {
              style: {
                borderTop: `1px solid ${colors.borderSubtle}`,
                padding: '20px 36px 24px',
              },
            },
            createElement(
              Text,
              {
                style: {
                  color: colors.fgFaint,
                  fontSize: 11,
                  margin: 0,
                },
              },
              '\u00A9 ',
              footerYear,
              ' ',
              brand.footer,
            ),
          ),
        ),
      ),
    ),
  )
}
export type EmailHeadingProps = {
  readonly children?: React.ReactNode
  readonly kicker?: string
}
export function EmailHeading({ children, kicker }: EmailHeadingProps) {
  const { colors } = useEmailTheme()
  return createElement(
    Fragment,
    {},
    kicker !== undefined &&
      kicker !== '' &&
      createElement(
        Text,
        {
          style: {
            color: colors.fgMuted,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.18em',
            margin: '0 0 12px',
            textTransform: 'uppercase',
          },
        },
        kicker,
      ),
    createElement(
      Text,
      {
        style: {
          color: colors.fgStrong,
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: '1.15',
          margin: 0,
        },
      },
      children,
    ),
  )
}
export type EmailBodyTextProps = {
  readonly children?: React.ReactNode
  readonly muted?: boolean
  readonly size?: 'sm' | 'base'
  readonly style?: React.CSSProperties
}
export function EmailBodyText({ children, muted, size = 'base', style }: EmailBodyTextProps) {
  const { colors } = useEmailTheme()
  return createElement(
    Text,
    {
      style: {
        color: muted === true ? colors.fgMuted : colors.fg,
        fontSize: size === 'sm' ? 14 : 15,
        lineHeight: size === 'sm' ? '22px' : '24px',
        margin: '14px 0 0',
        ...style,
      },
    },
    children,
  )
}
export type EmailButtonProps = {
  readonly href: string
  readonly children?: React.ReactNode
  readonly variant?: 'primary' | 'destructive'
}
export function EmailButton({ href, children, variant = 'primary' }: EmailButtonProps) {
  const { colors } = useEmailTheme()
  const backgroundColor =
    variant === 'destructive' ? colors.destructive : (colors.primary ?? colors.fgStrong)
  return createElement(
    Section,
    {
      style: {
        margin: '28px 0 0',
      },
    },
    createElement(
      Link,
      {
        className: 'cursor-pointer',
        href: href,
        style: {
          backgroundColor,
          borderRadius: 10,
          color: colors.onAccent,
          display: 'inline-block',
          fontSize: 14,
          fontWeight: 500,
          padding: '12px 24px',
          textDecoration: 'none',
        },
      },
      children,
    ),
  )
}
export type EmailFallbackProps = {
  readonly url: string
  readonly label?: string
}
export function EmailFallback({
  url,
  label = 'If the button does not work, copy this link:',
}: EmailFallbackProps) {
  const { colors } = useEmailTheme()
  return createElement(
    Section,
    {
      style: {
        margin: '32px 0 0',
      },
    },
    createElement(
      Text,
      {
        style: {
          color: colors.fgMuted,
          fontSize: 12,
          margin: '0 0 6px',
        },
      },
      label,
    ),
    createElement(
      Link,
      {
        className: 'cursor-pointer',
        href: url,
        style: {
          color: colors.fg,
          fontSize: 12,
          overflowWrap: 'anywhere',
          textDecoration: 'underline',
          textUnderlineOffset: 2,
          wordBreak: 'break-all',
        },
      },
      url,
    ),
  )
}

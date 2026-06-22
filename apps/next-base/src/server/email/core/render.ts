import type { ReactElement } from 'react'
import { render } from 'react-email'

export interface RenderedBody {
  html: string
  text: string
}

/** Turns a React Email component into HTML + text. */
export type EmailRenderer = (react: ReactElement) => Promise<RenderedBody>

/** Default renderer via `@react-email/render`. */
export const renderEmail: EmailRenderer = async (react) => {
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })])
  return { html, text }
}

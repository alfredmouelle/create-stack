import type { ReactElement } from 'react'
import { render } from 'react-email'

export interface RenderedBody {
  html: string
  text: string
}

/** A function that turns a React Email component into HTML + plain text. */
export type EmailRenderer = (react: ReactElement) => Promise<RenderedBody>

/** Default renderer backed by `@react-email/render`. */
export const renderEmail: EmailRenderer = async (react) => {
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })])
  return { html, text }
}

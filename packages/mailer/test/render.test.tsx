import { describe, expect, it } from 'vitest'
import { renderEmail } from '../src/factory.js'
import { WelcomeEmail } from './templates/welcome.js'

describe('renderEmail', () => {
  it('renders a React Email component to HTML and plain text', async () => {
    const { html, text } = await renderEmail(
      <WelcomeEmail name="Alfred" verifyUrl="https://app.test/verify" />,
    )

    expect(html).toContain('<html')
    expect(html).toContain('Alfred')
    expect(html).toContain('https://app.test/verify')

    // toPlainText strips the comment nodes React injects between text fragments
    expect(text).toMatch(/Welcome,\s*Alfred\s*!/i)
    expect(text).toContain('Verify my email')
    expect(text).not.toContain('<html')
  })
})

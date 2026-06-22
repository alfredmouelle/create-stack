import { describe, expect, it, vi } from 'vitest'
import { type ResendClient, resendAdapter } from '../src/adapters/resend/index.js'
import { MailerError, type RenderedMessage } from '../src/core/port.js'

function rendered(overrides: Partial<RenderedMessage> = {}): RenderedMessage {
  return {
    to: [{ email: 'user@test.com' }],
    from: { email: 'no-reply@acme.com', name: 'Acme' },
    subject: 'Hi',
    html: '<p>hi</p>',
    text: 'hi',
    ...overrides,
  }
}

describe('resendAdapter', () => {
  it('throws at construction when the api key is missing', () => {
    expect(() => resendAdapter({ apiKey: '' })).toThrow()
  })

  it('maps the rendered message to the Resend payload', async () => {
    const send = vi.fn(async () => ({ data: { id: 're_123' }, error: null }))
    const client: ResendClient = { emails: { send } }
    const adapter = resendAdapter({ apiKey: 'key', client })

    const result = await adapter.send(
      rendered({
        cc: [{ email: 'c@test.com' }],
        replyTo: { email: 'reply@acme.com' },
        tags: { campaign: 'welcome' },
      }),
    )

    expect(result).toEqual({ id: 're_123' })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Acme <no-reply@acme.com>',
        to: ['user@test.com'],
        subject: 'Hi',
        html: '<p>hi</p>',
        text: 'hi',
        replyTo: 'reply@acme.com',
        cc: ['c@test.com'],
        tags: [{ name: 'campaign', value: 'welcome' }],
      }),
    )
  })

  it('wraps a Resend error into a MailerError', async () => {
    const send = vi.fn(async () => ({ data: null, error: { message: 'bad request' } }))
    const adapter = resendAdapter({ apiKey: 'key', client: { emails: { send } } })

    await expect(adapter.send(rendered())).rejects.toBeInstanceOf(MailerError)
  })
})

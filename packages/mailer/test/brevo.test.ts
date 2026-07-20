import { describe, expect, it, vi } from 'vitest'
import { type BrevoClientLike, brevoAdapter } from '../src/adapters/brevo.js'
import { MailerError, type RenderedMessage } from '../src/port.js'

function rendered(overrides: Partial<RenderedMessage> = {}): RenderedMessage {
  return {
    to: [{ email: 'user@test.com', name: 'User' }],
    from: { email: 'no-reply@acme.com', name: 'Acme' },
    subject: 'Hi',
    html: '<p>hi</p>',
    text: 'hi',
    ...overrides,
  }
}

type SendFn = BrevoClientLike['transactionalEmails']['sendTransacEmail']

function fakeClient(send: SendFn = vi.fn(async () => ({ messageId: '<abc@brevo>' }))) {
  const client: BrevoClientLike = { transactionalEmails: { sendTransacEmail: send } }
  return { client, send }
}

describe('brevoAdapter', () => {
  it('throws at construction when the api key is missing', () => {
    expect(() => brevoAdapter({ apiKey: '' })).toThrow(MailerError)
  })

  it('maps the rendered message to the Brevo request', async () => {
    const { client, send } = fakeClient()
    const adapter = brevoAdapter({ apiKey: 'key', client })

    const result = await adapter.send(
      rendered({ replyTo: { email: 'reply@acme.com' }, tags: { campaign: 'welcome' } }),
    )

    expect(result).toEqual({ id: '<abc@brevo>' })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        sender: { email: 'no-reply@acme.com', name: 'Acme' },
        to: [{ email: 'user@test.com', name: 'User' }],
        subject: 'Hi',
        htmlContent: '<p>hi</p>',
        textContent: 'hi',
        replyTo: { email: 'reply@acme.com' },
        tags: ['campaign:welcome'],
      }),
    )
  })

  it('falls back to the first messageIds entry when messageId is absent', async () => {
    const { client } = fakeClient(vi.fn(async () => ({ messageIds: ['<x@brevo>'] })))
    const adapter = brevoAdapter({ apiKey: 'key', client })
    await expect(adapter.send(rendered())).resolves.toEqual({ id: '<x@brevo>' })
  })

  it('wraps a client error into a MailerError', async () => {
    const { client } = fakeClient(
      vi.fn(async () => {
        throw new Error('brevo down')
      }),
    )
    const adapter = brevoAdapter({ apiKey: 'key', client })
    await expect(adapter.send(rendered())).rejects.toBeInstanceOf(MailerError)
  })
})

import { describe, expect, it, type Mock, vi } from 'vitest'
import { type SesClientLike, sesAdapter } from '../src/adapters/ses/index.js'
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

describe('sesAdapter', () => {
  it('maps the rendered message to the SESv2 SendEmail input', async () => {
    const send: Mock<SesClientLike['send']> = vi.fn(async () => ({ MessageId: 'ses_123' }))
    const client: SesClientLike = { send }
    const adapter = sesAdapter({ client, configurationSetName: 'newsletter' })

    const result = await adapter.send(
      rendered({
        cc: [{ email: 'c@test.com' }],
        replyTo: { email: 'reply@acme.com' },
        tags: { campaign: 'welcome' },
      }),
    )

    expect(result).toEqual({ id: 'ses_123' })
    const input = send.mock.calls[0]?.[0].input
    expect(input).toMatchObject({
      FromEmailAddress: 'Acme <no-reply@acme.com>',
      Destination: { ToAddresses: ['user@test.com'], CcAddresses: ['c@test.com'] },
      ReplyToAddresses: ['reply@acme.com'],
      EmailTags: [{ Name: 'campaign', Value: 'welcome' }],
      ConfigurationSetName: 'newsletter',
      Content: {
        Simple: {
          Subject: { Data: 'Hi' },
          Body: { Html: { Data: '<p>hi</p>' }, Text: { Data: 'hi' } },
        },
      },
    })
  })

  it('rejects attachments with a MailerError (SES needs raw MIME)', async () => {
    const adapter = sesAdapter({ client: { send: vi.fn() } })

    await expect(
      adapter.send(rendered({ attachments: [{ filename: 'a.pdf', content: 'data' }] })),
    ).rejects.toBeInstanceOf(MailerError)
  })

  it('wraps a missing MessageId into a MailerError', async () => {
    const adapter = sesAdapter({ client: { send: vi.fn(async () => ({})) } })

    await expect(adapter.send(rendered())).rejects.toBeInstanceOf(MailerError)
  })

  it('wraps a send failure into a MailerError', async () => {
    const send = vi.fn(async () => {
      throw new Error('throttled')
    })
    const adapter = sesAdapter({ client: { send } })

    await expect(adapter.send(rendered())).rejects.toMatchObject({
      name: 'MailerError',
      adapter: 'ses',
    })
  })
})

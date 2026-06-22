import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { MailerAdapter, RenderedMessage } from '../src/core/port.js'
import { createMailer } from '../src/factory.js'

function fakeAdapter() {
  const sent: RenderedMessage[] = []
  const adapter: MailerAdapter = {
    name: 'fake',
    async send(message) {
      sent.push(message)
      return { id: 'fake-id' }
    },
  }
  return { adapter, sent }
}

const render = vi.fn(async () => ({ html: '<p>hi</p>', text: 'hi' }))
const react = null as unknown as ReactElement

describe('createMailer', () => {
  it('renders the body once and forwards html + text to the adapter', async () => {
    const { adapter, sent } = fakeAdapter()
    const mailer = createMailer({ adapter, from: 'Acme <no-reply@acme.com>', render })

    const result = await mailer.send({ to: 'user@test.com', subject: 'Hi', react })

    expect(result).toEqual({ id: 'fake-id' })
    expect(sent[0]?.html).toBe('<p>hi</p>')
    expect(sent[0]?.text).toBe('hi')
  })

  it('applies the default sender and parses "Name <email>" form', async () => {
    const { adapter, sent } = fakeAdapter()
    const mailer = createMailer({ adapter, from: 'Acme <no-reply@acme.com>', render })

    await mailer.send({ to: 'user@test.com', subject: 'Hi', react })

    expect(sent[0]?.from).toEqual({ name: 'Acme', email: 'no-reply@acme.com' })
  })

  it('lets a message override the sender', async () => {
    const { adapter, sent } = fakeAdapter()
    const mailer = createMailer({ adapter, from: 'no-reply@acme.com', render })

    await mailer.send({ to: 'user@test.com', from: 'support@acme.com', subject: 'Hi', react })

    expect(sent[0]?.from).toEqual({ email: 'support@acme.com' })
  })

  it('normalizes single and multiple recipients for to/cc/bcc', async () => {
    const { adapter, sent } = fakeAdapter()
    const mailer = createMailer({ adapter, from: 'no-reply@acme.com', render })

    await mailer.send({
      to: ['a@test.com', { email: 'b@test.com', name: 'Bee' }],
      cc: 'c@test.com',
      bcc: ['d@test.com'],
      subject: 'Hi',
      react,
    })

    expect(sent[0]?.to).toEqual([{ email: 'a@test.com' }, { email: 'b@test.com', name: 'Bee' }])
    expect(sent[0]?.cc).toEqual([{ email: 'c@test.com' }])
    expect(sent[0]?.bcc).toEqual([{ email: 'd@test.com' }])
  })
})

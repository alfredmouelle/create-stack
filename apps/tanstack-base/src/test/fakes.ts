import { createMailer } from '~/server/email/factory'
import type { Mailer, RenderedMessage } from '~/server/email/port'

export function createInMemoryMailer(): {
  readonly mailer: Mailer
  readonly outbox: RenderedMessage[]
} {
  const outbox: RenderedMessage[] = []
  const mailer = createMailer({
    from: 'no-reply@example.com',
    adapter: {
      name: 'in-memory',
      send(message) {
        outbox.push(message)
        return Promise.resolve({ id: `in-memory-${outbox.length}` })
      },
    },
  })
  return { mailer, outbox }
}

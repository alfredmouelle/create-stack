import { createMailer } from '~/server/email/factory'
import type { Mailer, RenderedMessage } from '~/server/email/port'

export function createInMemoryMailer(): { mailer: Mailer; outbox: RenderedMessage[] } {
  const outbox: RenderedMessage[] = []
  const mailer = createMailer({
    from: 'no-reply@example.com',
    adapter: {
      name: 'in-memory',
      async send(message) {
        outbox.push(message)
        return { id: `in-memory-${outbox.length}` }
      },
    },
  })
  return { mailer, outbox }
}

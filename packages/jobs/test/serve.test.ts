import { eventType, Inngest, staticSchema } from 'inngest'
import { describe, expect, it } from 'vitest'
import { jobsHandler } from '../src/serve.js'

const userSignedUp = eventType('user/signed-up', {
  schema: staticSchema<{ userId: string }>(),
})

/** Built exactly the way an app is told to build one, against the real SDK. */
function buildApp() {
  const client = new Inngest({ id: 'jobs-test', isDev: true })
  const welcome = client.createFunction(
    { id: 'send-welcome', triggers: [{ event: userSignedUp }] },
    async ({ event }) => {
      // `event.data` is typed from the eventType, not `any`.
      const userId: string = event.data.userId
      return { userId }
    },
  )
  return { client, functions: [welcome] }
}

/** Inngest resolves the request URL against the `host` header, which undici omits. */
const request = (path = '/api/inngest') =>
  new Request(`http://localhost${path}`, { headers: { host: 'localhost' } })

describe('jobsHandler', () => {
  it('accepts functions built with the real Inngest v4 API', () => {
    // Regression: the previous adapter called createFunction(config, trigger, handler),
    // the v3 3-arg form, which throws at registration against v4.
    expect(() => buildApp()).not.toThrow()
  })

  it('returns a web-standard fetch handler', () => {
    const { client, functions } = buildApp()
    const handler = jobsHandler({ client, functions })
    expect(typeof handler).toBe('function')
    expect(handler.length).toBeLessThanOrEqual(1)
  })

  it('responds to an introspection GET', async () => {
    const { client, functions } = buildApp()
    const handler = jobsHandler({ client, functions })
    const response = await handler(request())
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBeLessThan(500)
  })

  it('exposes every registered function to Inngest', async () => {
    const { client, functions } = buildApp()
    const second = client.createFunction(
      { id: 'second', triggers: [{ event: userSignedUp }] },
      async () => undefined,
    )
    const handler = jobsHandler({ client, functions: [...functions, second] })
    // biome-ignore lint/style/useNamingConvention: Inngest's introspection wire format
    const body = (await (await handler(request())).json()) as { function_count: number }
    expect(body.function_count).toBe(2)
  })

  it('forwards servePath through to Inngest', () => {
    const { client, functions } = buildApp()
    expect(() => jobsHandler({ client, functions, servePath: '/api/inngest' })).not.toThrow()
  })
})

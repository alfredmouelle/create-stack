import { createServer } from 'node:http'
import { createRequestListener } from 'remix/node-fetch-server'
import { assets } from './assets.ts'
import './env.ts'
import { router } from './router.tsx'
import { captureServerError } from './server/observability.ts'

const port = Number(process.env.PORT ?? 3000)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('PORT must be a valid port number')

const server = createServer(
  createRequestListener(
    async (request) => {
      try {
        return await router.fetch(request)
      } catch (error) {
        captureServerError(error)
        return new Response('An unexpected error occurred. Please try again.', { status: 500 })
      }
    },
    { trustProxy: process.env.TRUST_PROXY === '1' },
  ),
)

server.listen(port, process.env.HOST ?? '127.0.0.1', () => {
  // biome-ignore lint/suspicious/noConsole: startup address for local and production operators.
  console.log(`Remix listening on http://localhost:${port}`)
})

let closing = false
function shutdown(): void {
  if (closing) return
  closing = true
  server.close(() => {
    void assets.close().then(() => process.exit(0))
  })
  server.closeIdleConnections()
}
process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

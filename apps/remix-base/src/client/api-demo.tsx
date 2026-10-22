import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { Handle } from 'remix/component'
import { clientEntry, on } from 'remix/component'
import superjson from 'superjson'
import type { AppRouter } from '../server/api/root.ts'

export const ApiDemo = clientEntry(import.meta.url, function ApiDemo(handle: Handle) {
  let result = 'Ready to check the API.'
  let pending = false
  return () => (
    <section class="mx-auto grid max-w-lg gap-4 p-8">
      <h1 class="font-semibold text-3xl">API connection</h1>
      <output>{result}</output>
      <button
        class="cursor-pointer rounded-lg bg-primary px-4 py-2 text-primary-foreground"
        disabled={pending}
        mix={on('click', async () => {
          pending = true
          void handle.update()
          try {
            const client = createTRPCClient<AppRouter>({
              links: [httpBatchLink({ url: '/api/trpc', transformer: superjson })],
            })
            const response = await client.health.ping.query()
            result = response.ok ? `Connected at ${response.time}` : 'Connection failed.'
          } catch {
            result = 'Unable to reach the API. Try again.'
          } finally {
            pending = false
            void handle.update()
          }
        })}
        type="button"
      >
        {pending ? 'Checking…' : 'Check API'}
      </button>
      <a class="cursor-pointer hover:underline" href="/">
        Back to home
      </a>
    </section>
  )
})

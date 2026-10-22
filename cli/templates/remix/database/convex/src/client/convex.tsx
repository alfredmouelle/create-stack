import { ConvexClient } from 'convex/browser'
import { clientEntry, on } from 'remix/component'
import type { Handle } from 'remix/component'
import { api } from './convex-api.ts'

export const ConvexDemo = clientEntry(import.meta.url, function ConvexDemo(handle: Handle<{ url: string; tokenEndpoint: string | null }>) {
  let messages: { _id: string; author: string; body: string }[] = []
  let client: ConvexClient | undefined
  let error = ''
  let pending = false
  handle.queueTask(async () => {
    client = new ConvexClient(handle.props.url)
    if (handle.props.tokenEndpoint) {
      const endpoint = handle.props.tokenEndpoint
      client.setAuth(async () => {
        const response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' })
        const result: unknown = await response.json()
        return typeof result === 'object' && result !== null && 'token' in result && typeof result.token === 'string' ? result.token : null
      })
    }
    const unsubscribe = client.onUpdate(api.messages.list, {}, (value) => { messages = value; error = ''; void handle.update() }, () => { error = 'Unable to load messages.'; void handle.update() })
    handle.signal.addEventListener('abort', () => { unsubscribe(); void client?.close() }, { once: true })
  })
  return () => <section class="mx-auto grid max-w-lg gap-4 p-8"><h1 class="font-semibold text-3xl">Messages</h1>{error ? <p role="alert">{error}</p> : null}<ul class="grid gap-2">{messages.map((message) => <li key={message._id}><strong>{message.author}</strong>: {message.body}</li>)}</ul><form class="grid gap-3" mix={on('submit', async (event) => {
    event.preventDefault()
    if (!client || pending) return
    const form = event.currentTarget
    const data = new FormData(form)
    const author = data.get('author')
    const body = data.get('body')
    if (typeof author !== 'string' || typeof body !== 'string' || !author.trim() || !body.trim()) return
    pending = true
    void handle.update()
    try { await client.mutation(api.messages.send, { author: author.trim(), body: body.trim() }); form.reset() } catch { error = 'Unable to send the message.' } finally { pending = false; void handle.update() }
  })}><label class="grid gap-1">Name<input type="text" name="author" required maxLength={120} class="rounded-lg border p-2" /></label><label class="grid gap-1">Message<input type="text" name="body" required maxLength={2000} class="rounded-lg border p-2" /></label><button class="cursor-pointer rounded-lg bg-primary p-2 text-primary-foreground" type="submit" disabled={pending}>{pending ? 'Sending…' : 'Send message'}</button></form><a href="/" class="cursor-pointer hover:underline">Back to home</a></section>
})

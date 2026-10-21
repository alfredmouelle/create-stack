import { createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery } from 'convex/react'
import { type FormEvent, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/convex-demo')({ component: ConvexDemo })

function ConvexDemo() {
  const messages = useQuery(api.messages.list)
  const send = useMutation(api.messages.send)
  const [body, setBody] = useState('')

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    await send({ author: 'You', body })
    setBody('')
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8">
      <h1 className="font-bold text-3xl">Convex</h1>

      <form className="flex gap-2" onSubmit={onSubmit}>
        <Input
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message…"
          value={body}
        />
        <Button type="submit">Send</Button>
      </form>

      <ul className="space-y-2">
        {messages?.map((m) => (
          <li className="rounded-md border p-3" key={m._id}>
            <span className="font-medium">{m.author}</span>: {m.body}
          </li>
        ))}
      </ul>
    </div>
  )
}

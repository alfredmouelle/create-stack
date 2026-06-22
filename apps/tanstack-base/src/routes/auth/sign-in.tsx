import { createFileRoute, useRouter } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { authClient } from '~/server/better-auth/client'

export const Route = createFileRoute('/auth/sign-in')({ component: SignIn })

function SignIn() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const form = new FormData(e.currentTarget)
    const { error } = await authClient.signIn.email({
      email: String(form.get('email')),
      password: String(form.get('password')),
    })
    if (error) {
      setError(error.message ?? 'Sign in failed')
      return
    }
    router.navigate({ to: '/' })
  }

  return (
    <form className="mx-auto flex max-w-sm flex-col gap-3 p-8" onSubmit={onSubmit}>
      <h1 className="font-heading font-medium text-xl">Sign in</h1>
      <Input name="email" placeholder="Email" required type="email" />
      <Input name="password" placeholder="Password" required type="password" />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit">Sign in</Button>
    </form>
  )
}

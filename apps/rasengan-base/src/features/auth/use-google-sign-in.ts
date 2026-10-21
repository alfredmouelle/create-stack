import { useEffect, useState } from 'react'
import * as v from 'valibot'
import { authClient } from '~/server/better-auth/client'

export function useGoogleSignIn(callbackURL: string): {
  readonly available: boolean
  readonly loading: boolean
  readonly error: string | null
  readonly signIn: () => Promise<void>
} {
  const [available, setAvailable] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/auth/providers', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load sign-in providers')
        const value: unknown = await response.json()
        setAvailable(v.parse(v.object({ google: v.boolean() }), value).google)
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false)
      })
    return () => {
      controller.abort()
    }
  }, [])
  const signIn = async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const result = await authClient.signIn.social({ provider: 'google', callbackURL })
      if (result.error) setError(result.error.message ?? 'Unable to sign in with Google')
    } finally {
      setLoading(false)
    }
  }
  return { available, loading, error, signIn }
}

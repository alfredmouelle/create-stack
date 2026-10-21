import { useNavigate } from 'rasengan'
import { useState } from 'react'
import { authClient } from '~/server/better-auth/client'

export function useSignOut(): { readonly pending: boolean; readonly signOut: () => Promise<void> } {
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const signOut = async (): Promise<void> => {
    setPending(true)
    try {
      const { error } = await authClient.signOut()
      if (error) throw new Error(error.message ?? 'Unable to sign out')
      await navigate('/auth/sign-in')
    } finally {
      setPending(false)
    }
  }
  return { pending, signOut }
}

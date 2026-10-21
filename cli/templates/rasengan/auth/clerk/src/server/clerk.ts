import { createClerkClient } from '@clerk/backend'
import * as v from 'valibot'

export async function auth(headers: Headers): Promise<{ readonly userId: string | null }> {
  const publishableKey = v.parse(v.string(), process.env.RASENGAN_CLERK_PUBLISHABLE_KEY)
  const secretKey = v.parse(v.string(), process.env.CLERK_SECRET_KEY)
  const authorizedParties = v.parse(v.array(v.pipe(v.string(), v.url())),
    (process.env.CLERK_AUTHORIZED_PARTIES ?? 'http://localhost:3000').split(','))
  const client = createClerkClient({ publishableKey, secretKey })
  const request = new Request(new URL('/api/session', authorizedParties[0]), { headers })
  const state = await client.authenticateRequest(request, { authorizedParties })
  return { userId: state.isAuthenticated ? state.toAuth().userId : null }
}

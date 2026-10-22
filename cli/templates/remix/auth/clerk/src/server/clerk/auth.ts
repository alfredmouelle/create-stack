import { createClerkClient } from '@clerk/backend'
import * as v from 'valibot'

export type ClerkIdentity = {
  readonly userId: string | null
  readonly headers: Headers
  readonly getToken: (options: { readonly template: string }) => Promise<string | null>
}

export async function authenticate(request: Request): Promise<ClerkIdentity> {
  const publishableKey = v.parse(v.pipe(v.string(), v.minLength(1)), process.env.REMIX_CLERK_PUBLISHABLE_KEY)
  const secretKey = v.parse(v.pipe(v.string(), v.minLength(1)), process.env.CLERK_SECRET_KEY)
  const authorizedParties = v.parse(v.array(v.pipe(v.string(), v.url())), (process.env.CLERK_AUTHORIZED_PARTIES ?? 'http://localhost:3000').split(','))
  const client = createClerkClient({ publishableKey, secretKey })
  const state = await client.authenticateRequest(request, { authorizedParties, ...(process.env.CLERK_JWT_KEY ? { jwtKey: process.env.CLERK_JWT_KEY } : {}) })
  const identity = state.toAuth()
  return { userId: identity?.userId ?? null, headers: state.headers, getToken: (options: { readonly template: string }) => identity?.getToken(options) ?? Promise.resolve(null) }
}

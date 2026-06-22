import { headers } from 'next/headers'
import { cache } from 'react'
import { auth } from '.'

/** Per-request cached session lookup (uses the cookie cache). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

/** Bypasses the cookie cache — use for sensitive checks. */
export const getFreshSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  }),
)

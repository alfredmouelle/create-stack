import { headers } from 'next/headers'
import { cache } from 'react'
import { auth } from '.'

/** Per-request cached session (uses cookie cache). */
export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

/** Bypasses cookie cache; use for sensitive checks. */
export const getFreshSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  }),
)

import { headers } from 'next/headers'
import { cache } from 'react'
import { auth } from '.'

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }))

export const getFreshSession = cache(async () =>
  auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  }),
)

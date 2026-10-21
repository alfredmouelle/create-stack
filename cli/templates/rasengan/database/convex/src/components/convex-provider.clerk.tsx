import { useAuth } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'
import * as v from 'valibot'

const client = new ConvexReactClient(v.parse(v.pipe(v.string(), v.url()), import.meta.env.RASENGAN_CONVEX_URL))

export function ConvexClientProvider({ children }: { readonly children: ReactNode }) {
  return <ConvexProviderWithClerk client={client} useAuth={useAuth}>{children}</ConvexProviderWithClerk>
}

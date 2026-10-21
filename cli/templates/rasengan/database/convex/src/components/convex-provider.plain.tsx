import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import * as v from 'valibot'

const client = new ConvexReactClient(v.parse(v.pipe(v.string(), v.url()), import.meta.env.RASENGAN_CONVEX_URL))

export function ConvexClientProvider({ children }: { readonly children: ReactNode }) {
  return <ConvexProvider client={client}>{children}</ConvexProvider>
}

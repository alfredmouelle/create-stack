// Loads the TanStack Start augmentation that adds `server` to route options.

import { createFileRoute } from '@tanstack/react-router'
import type {} from '@tanstack/react-start'
import { auth } from '~/server/better-auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
})

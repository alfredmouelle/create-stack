import { jobs } from './services.js'

/**
 * Example job definition. With the memory adapter it runs inline on `trigger`;
 * with the Inngest adapter it is registered and served at `/api/inngest`. The
 * handler body is identical either way — and identical to the TanStack app.
 */
export const onUserSignedUp = jobs.defineJob<{ userId: string }>({
  id: 'on-user-signed-up',
  event: 'user/signed-up',
  handler: async ({ data }) => {
    void data
  },
})

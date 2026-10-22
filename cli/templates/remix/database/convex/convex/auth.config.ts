import type { AuthConfig } from 'convex/server'

const issuer = process.env.CLERK_ISSUER_URL
if (!issuer) throw new Error('Set CLERK_ISSUER_URL in the Convex deployment environment.')

export default { providers: [{ domain: issuer, applicationID: 'convex' }] } satisfies AuthConfig

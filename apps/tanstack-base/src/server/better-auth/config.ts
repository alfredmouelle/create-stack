import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { env } from '~/env'
import { db } from '~/server/db'
import { mailer as providerMailer } from '~/server/email'
import type { Mailer } from '~/server/email/port'
import { sendPasswordResetEmail, sendVerificationEmail } from './emails'

const socialProviders =
  env.BETTER_AUTH_GOOGLE_CLIENT_ID !== undefined &&
  env.BETTER_AUTH_GOOGLE_CLIENT_ID !== '' &&
  env.BETTER_AUTH_GOOGLE_CLIENT_SECRET !== undefined &&
  env.BETTER_AUTH_GOOGLE_CLIENT_SECRET !== ''
    ? {
        google: {
          clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
          clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined

export function createAuth({ mailer }: { readonly mailer: Mailer }) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'pg',
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        await sendPasswordResetEmail({
          mailer,
          to: { email: user.email, name: user.name },
          url,
        })
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60,
      sendVerificationEmail: async ({ user, url }) => {
        await sendVerificationEmail({
          mailer,
          to: { email: user.email, name: user.name },
          url,
        })
      },
    },
    socialProviders,
    user: {
      additionalFields: {},
    },
    trustedOrigins: [
      env.BETTER_AUTH_URL,
      ...(env.NODE_ENV === 'development' ? ['http://localhost:*'] : []),
    ],
    rateLimit: {
      enabled: env.NODE_ENV === 'production',
      window: 60,
      max: 100,
      customRules: {
        '/sign-up/email': { window: 60, max: 5 },
        '/sign-in/email': { window: 60, max: 10 },
        '/forget-password': { window: 60, max: 3 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
      },
    },
    plugins: [tanstackStartCookies()],
  })
}

export const auth = createAuth({ mailer: providerMailer })

export type Session = typeof auth.$Infer.Session

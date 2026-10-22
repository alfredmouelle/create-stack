import { expect, test } from 'vitest'
import { createApplication } from '../../router.tsx'
import { createInMemoryMailer } from '../../test/fakes.ts'
import { createAuth } from './config.ts'

const origin = 'http://localhost:3074'

test('signs up through a native form and sends a branded verification email', async () => {
  const { mailer, outbox } = createInMemoryMailer()
  const application = createApplication(createAuth({ mailer }))
  const response = await application.fetch(`${origin}/auth/sign-up`, {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({
      name: 'Alex Morgan',
      email: 'alex.morgan@example.com',
      password: 'CopperRiver2026!',
    }),
  })

  expect(response.status).toBe(303)
  expect(response.headers.get('location')).toBe(
    '/auth/verify-email?email=alex.morgan%40example.com',
  )
  expect(outbox).toHaveLength(1)
  expect(outbox[0]?.subject).toBe('Confirm your email address')
  expect(outbox[0]?.html).toContain('App')
  expect(outbox[0]?.html).toContain('Confirm your address.')
  expect(outbox[0]?.html).toContain('Alex Morgan')
})

function emailLink(html: string | undefined, path: string): string {
  if (html === undefined) throw new Error('Missing email HTML')
  const link = [...html.matchAll(/href="([^"]+)"/gu)]
    .map((match) => match[1]?.replaceAll('&amp;', '&'))
    .find((href) => href?.includes(path) === true)
  if (link === undefined) throw new Error(`Missing ${path} link`)
  return link
}

function requiredValue(value: string | null): string {
  if (value === null) throw new Error('Missing authentication redirect value')
  return value
}

function cookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

test('verifies email, isolates sessions, signs out, and resets the password through native routes', async () => {
  const { mailer, outbox } = createInMemoryMailer()
  const application = createApplication(createAuth({ mailer }))
  const email = 'jordan.lee@example.com'
  const password = 'CedarValley2026!'
  const post = (path: string, body: Readonly<Record<string, string>>, cookie = '') =>
    application.fetch(`${origin}${path}`, {
      method: 'POST',
      headers: { origin, cookie },
      body: new URLSearchParams(body),
    })
  expect((await post('/auth/sign-up', { name: 'Jordan Lee', email, password })).status).toBe(303)
  expect((await post('/auth/sign-in', { email, password })).status).toBe(400)
  const verification = await application.fetch(emailLink(outbox[0]?.html, '/verify-email'))
  expect(verification.status).toBe(302)
  const cookie = cookies(verification)
  expect(cookie).toContain('better-auth.session_token=')
  const dashboard = await application.fetch(`${origin}/dashboard`, { headers: { cookie } })
  expect(await dashboard.text()).toContain('Jordan Lee')
  const anonymous = await application.fetch(`${origin}/dashboard`)
  expect(anonymous.headers.get('location')).toBe('/auth/sign-in')
  expect((await post('/auth/sign-out', {}, cookie)).headers.getSetCookie().join('')).toContain(
    'Max-Age=0',
  )
  expect((await application.fetch(`${origin}/dashboard`, { headers: { cookie } })).status).toBe(303)
  expect((await post('/auth/forgot-password', { email })).status).toBe(303)
  const resetUrl = emailLink(outbox.at(-1)?.html, 'reset-password')
  const resetRedirect = await application.fetch(resetUrl)
  const location = requiredValue(resetRedirect.headers.get('location'))
  const token = requiredValue(new URL(location, origin).searchParams.get('token'))
  expect(token.length).toBeGreaterThan(0)
  expect(
    (
      await post('/auth/reset-password', {
        password: 'OakMeadow2026!',
        confirmPassword: 'different-value',
        token,
      })
    ).status,
  ).toBe(422)
  expect(
    (
      await post('/auth/reset-password', {
        password: 'OakMeadow2026!',
        confirmPassword: 'OakMeadow2026!',
        token,
      })
    ).status,
  ).toBe(303)
  expect((await post('/auth/sign-in', { email, password })).status).toBe(400)
  const signedIn = await post('/auth/sign-in', { email, password: 'OakMeadow2026!' })
  expect(signedIn.status).toBe(303)
  expect(cookies(signedIn)).toContain('better-auth.session_token=')
})

test('rejects cross-origin and malformed forms without sending email or creating a session', async () => {
  const { mailer, outbox } = createInMemoryMailer()
  const application = createApplication(createAuth({ mailer }))
  const responses = await Promise.all(
    [
      'sign-in',
      'sign-up',
      'sign-out',
      'verify-email',
      'forgot-password',
      'reset-password',
      'google',
    ].map((path) =>
      application.fetch(`${origin}/auth/${path}`, {
        method: 'POST',
        headers: { origin: 'https://example.com' },
        body: new URLSearchParams({ email: 'riley.chen@example.com' }),
      }),
    ),
  )
  expect(responses.map((response) => response.status)).toEqual([403, 403, 403, 403, 403, 403, 403])
  expect(responses.some((response) => response.headers.has('set-cookie'))).toBe(false)
  const malformed = await application.fetch(`${origin}/auth/sign-up`, {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({ name: '', email: 'invalid-address', password: 'short' }),
  })
  expect(malformed.status).toBe(422)
  expect(await malformed.text()).toContain('Check your details')
  expect(outbox).toHaveLength(0)
})

test('preserves the reset token and reports mismatched passwords on the native form', async () => {
  const response = await createApplication().fetch(`${origin}/auth/reset-password`, {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({
      password: 'RiverBirch2026!',
      confirmPassword: 'MapleGrove2026!',
      token: 'reset-request-9f038be12e57',
    }),
  })
  expect(response.status).toBe(422)
  const html = await response.text()
  expect(html).toContain('Passwords do not match')
  expect(html).toContain('reset-request-9f038be12e57')
  expect(html).not.toContain('This reset link is invalid or expired')
})

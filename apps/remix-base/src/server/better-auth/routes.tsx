import type { Router } from 'remix/router'
import * as v from 'valibot'
import { renderPage } from '../../render.tsx'
import type { Session } from './config.ts'
import type { AuthScreen } from './pages.tsx'
import { AuthPage, Dashboard } from './pages.tsx'

export type Authentication = {
  readonly handler: (request: Request) => Promise<Response>
  readonly api: {
    readonly getSession: (input: { readonly headers: Headers }) => Promise<Session | null>
  }
}

const emailSchema = v.pipe(v.string(), v.trim(), v.email(), v.maxLength(254))
const passwordSchema = v.pipe(v.string(), v.minLength(8), v.maxLength(128))
const emailForm = v.object({ email: emailSchema })
const signInForm = v.object({ email: emailSchema, password: passwordSchema })
const signUpForm = v.object({
  email: emailSchema,
  password: passwordSchema,
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
})
const resetForm = v.pipe(
  v.object({
    password: passwordSchema,
    confirmPassword: passwordSchema,
    token: v.pipe(v.string(), v.minLength(1), v.maxLength(1024)),
  }),
  v.check((value) => value.password === value.confirmPassword, 'Passwords must match.'),
)

function redirect(location: string, source?: Response): Response {
  const headers = new Headers(source?.headers)
  headers.delete('content-type')
  headers.delete('content-length')
  headers.set('location', location)
  headers.set('cache-control', 'no-store')
  return new Response(null, { status: 303, headers })
}

function formText(form: FormData | undefined, name: string): string | undefined {
  const value = form?.get(name)
  return typeof value === 'string' ? value.slice(0, 1024) : undefined
}

function page(
  request: Request,
  screen: AuthScreen,
  error = '',
  status = 200,
  values?: FormData,
): Promise<Response> {
  const url = new URL(request.url)
  return renderPage(
    request,
    screen === 'sign-up' ? 'Create account' : 'Your account',
    <AuthPage
      email={formText(values, 'email') ?? url.searchParams.get('email') ?? ''}
      error={error}
      name={formText(values, 'name') ?? ''}
      screen={screen}
      sent={url.searchParams.get('sent') === '1'}
      token={
        url.searchParams.get('error') === 'INVALID_TOKEN'
          ? ''
          : (formText(values, 'token') ?? url.searchParams.get('token') ?? '')
      }
    />,
    status,
  )
}

function input(screen: AuthScreen, form: FormData): Record<string, string> | null {
  const entries = Object.fromEntries(form)
  if (screen === 'sign-up') {
    const result = v.safeParse(signUpForm, entries)
    return result.success ? result.output : null
  }
  if (screen === 'sign-in') {
    const result = v.safeParse(signInForm, entries)
    return result.success ? result.output : null
  }
  if (screen === 'reset-password') {
    const result = v.safeParse(resetForm, entries)
    return result.success
      ? { newPassword: result.output.password, token: result.output.token }
      : null
  }
  const result = v.safeParse(emailForm, entries)
  return result.success ? result.output : null
}

function forward(
  request: Request,
  authentication: Authentication,
  endpoint: string,
  body: Readonly<Record<string, string>>,
): Promise<Response> {
  const headers = new Headers(request.headers)
  headers.delete('content-length')
  headers.set('content-type', 'application/json')
  return authentication.handler(
    new Request(new URL(`/api/auth/${endpoint}`, request.url), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }),
  )
}

const endpoints = {
  'sign-in': 'sign-in/email',
  'sign-up': 'sign-up/email',
  'forgot-password': 'request-password-reset',
  'reset-password': 'reset-password',
  'verify-email': 'send-verification-email',
} as const

async function submit(
  request: Request,
  authentication: Authentication,
  screen: AuthScreen,
): Promise<Response> {
  if (request.headers.get('origin') !== new URL(request.url).origin)
    return new Response('Forbidden', { status: 403 })
  const form = await request.formData()
  const body = input(screen, form)
  if (!body) {
    const error =
      screen === 'reset-password' && form.get('password') !== form.get('confirmPassword')
        ? 'Passwords do not match'
        : 'Check your details and try again.'
    return page(request, screen, error, 422, form)
  }
  const callbackURL = new URL('/dashboard', request.url).href
  const response = await forward(request, authentication, endpoints[screen], {
    ...body,
    callbackURL,
    redirectTo: new URL('/auth/reset-password', request.url).href,
  })
  if (!response.ok)
    return page(
      request,
      screen,
      screen === 'sign-in'
        ? 'Unable to sign in. Check your details and confirm your email address.'
        : 'Unable to complete this request. Check your details and try again.',
      response.status >= 500 ? 502 : 400,
      form,
    )
  if (screen === 'sign-in') return redirect('/dashboard', response)
  if (screen === 'sign-up')
    return redirect(`/auth/verify-email?email=${encodeURIComponent(body.email ?? '')}`, response)
  if (screen === 'reset-password') return redirect('/auth/sign-in?reset=1', response)
  return redirect(`/auth/${screen}?sent=1&email=${encodeURIComponent(body.email ?? '')}`, response)
}

export function installAuthRoutes(router: Router, authentication: Authentication): void {
  router.route('ANY', '/api/auth/*path', ({ request }) => authentication.handler(request))
  for (const screen of [
    'sign-in',
    'sign-up',
    'forgot-password',
    'reset-password',
    'verify-email',
  ] as const) {
    router.get(`/auth/${screen}`, async ({ request }) =>
      (await authentication.api.getSession({ headers: request.headers }))
        ? redirect('/dashboard')
        : page(request, screen),
    )
    router.post(`/auth/${screen}`, ({ request }) => submit(request, authentication, screen))
  }
  router.get('/auth', () => redirect('/auth/sign-in'))
  router.get('/dashboard', async ({ request }) => {
    const session = await authentication.api.getSession({ headers: request.headers })
    if (!session) return redirect('/auth/sign-in')
    return renderPage(
      request,
      'Dashboard',
      <Dashboard email={session.user.email} name={session.user.name} />,
    )
  })
  router.post('/auth/sign-out', async ({ request }) => {
    if (request.headers.get('origin') !== new URL(request.url).origin)
      return new Response('Forbidden', { status: 403 })
    const response = await forward(request, authentication, 'sign-out', {})
    return response.ok
      ? redirect('/', response)
      : new Response('Unable to sign out', { status: 400 })
  })
  router.post('/auth/google', async ({ request }) => {
    if (request.headers.get('origin') !== new URL(request.url).origin)
      return new Response('Forbidden', { status: 403 })
    const response = await forward(request, authentication, 'sign-in/social', {
      provider: 'google',
      callbackURL: new URL('/dashboard', request.url).href,
    })
    const body: unknown = await response.json()
    if (
      !response.ok ||
      typeof body !== 'object' ||
      body === null ||
      !('url' in body) ||
      typeof body.url !== 'string'
    )
      return page(request, 'sign-in', 'Google sign-in is unavailable.', 400)
    const url = new URL(body.url)
    if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com')
      return page(request, 'sign-in', 'Google sign-in is unavailable.', 400)
    return redirect(url.href, response)
  })
}

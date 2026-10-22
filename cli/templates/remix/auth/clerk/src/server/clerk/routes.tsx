import type { Router } from 'remix/router'
import { AuthLayout } from '../../components/auth-layout.tsx'
import { ClerkForm } from '../../client/clerk.tsx'
import { renderPage } from '../../render.tsx'
import { authenticate } from './auth.ts'

export function installClerkRoutes(router: Router, convex: boolean): void {
  for (const screen of ['sign-in', 'sign-up'] as const) {
    router.get(`/auth/${screen}`, ({ request }) => renderPage(request, screen === 'sign-in' ? 'Sign in' : 'Create an account', <AuthLayout><ClerkForm key={screen} publishableKey={process.env.REMIX_CLERK_PUBLISHABLE_KEY ?? ''} screen={screen} /></AuthLayout>))
  }
  router.get('/api/session', async ({ request }) => {
    const identity = await authenticate(request)
    return Response.json({ userId: identity.userId }, { headers: { 'cache-control': 'no-store' } })
  })
  if (convex) {
    router.get('/api/convex-token', async ({ request }) => {
      const identity = await authenticate(request)
      return Response.json({ token: identity.userId ? await identity.getToken({ template: 'convex' }) : null }, { headers: { 'cache-control': 'no-store' } })
    })
  }
  router.get('/dashboard', async ({ request }) => {
    const identity = await authenticate(request)
    const location = identity.headers.get('location')
    if (location) return new Response(null, { status: 307, headers: identity.headers })
    if (!identity.userId) return new Response(null, { status: 303, headers: { location: '/auth/sign-in', 'cache-control': 'no-store' } })
    const response = await renderPage(request, 'Dashboard', <AuthLayout><div class="grid gap-4"><h1 class="font-semibold text-3xl">Your account</h1><ClerkForm key="user" publishableKey={process.env.REMIX_CLERK_PUBLISHABLE_KEY ?? ''} screen="user" /><a href="/" class="cursor-pointer hover:underline">Back to home</a></div></AuthLayout>)
    for (const cookie of identity.headers.getSetCookie()) response.headers.append('set-cookie', cookie)
    return response
  })
}

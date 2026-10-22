import { clientEntry, ref } from 'remix/component'
import type { Handle } from 'remix/component'

export const ClerkForm = clientEntry(import.meta.url, function ClerkForm(handle: Handle<{ publishableKey: string; screen: 'sign-in' | 'sign-up' | 'user' }>) {
  let container: HTMLDivElement | undefined
  let error = ''
  handle.queueTask(async () => {
    try {
      const { Clerk } = await import('@clerk/clerk-js')
      const clerk = new Clerk(handle.props.publishableKey)
      await clerk.load()
      if (!container || handle.signal.aborted) return
      const screen = handle.props.screen
      if (screen === 'user') clerk.mountUserButton(container)
      else if (screen === 'sign-in') clerk.mountSignIn(container, { routing: 'hash', signUpUrl: '/auth/sign-up', forceRedirectUrl: '/dashboard' })
      else clerk.mountSignUp(container, { routing: 'hash', signInUrl: '/auth/sign-in', forceRedirectUrl: '/dashboard' })
      handle.signal.addEventListener('abort', () => {
        if (!container) return
        if (screen === 'user') clerk.unmountUserButton(container)
        else if (screen === 'sign-in') clerk.unmountSignIn(container)
        else clerk.unmountSignUp(container)
      }, { once: true })
    } catch {
      error = 'Unable to load sign-in. Try again shortly.'
      void handle.update()
    }
  })
  return () => <div class="grid gap-4">{error ? <p role="alert">{error}</p> : null}<div mix={ref((node) => { container = node })} /></div>
})

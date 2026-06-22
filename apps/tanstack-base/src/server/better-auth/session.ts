import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '.'

/**
 * Server-fn resolving the better-auth session from request headers; use in
 * loaders / `beforeLoad`.
 *
 * `getRequest` is called INSIDE the handler on purpose: the Start plugin
 * extracts handlers server-side and strips the import from the client bundle.
 * Calling it at module scope would leak `@tanstack/react-start/server` into
 * client code (routes import this transitively) and trip import-protection.
 */
export const getServerSession = createServerFn({ method: 'GET' }).handler(() =>
  auth.api.getSession({ headers: getRequest().headers }),
)

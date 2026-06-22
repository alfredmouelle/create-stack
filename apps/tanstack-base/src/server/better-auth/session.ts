import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '.'

/**
 * Server-function: resolves the better-auth session from the current request
 * headers. Use it in route loaders / `beforeLoad`.
 *
 * The server-only `getRequest` call lives INSIDE the handler on purpose: the
 * TanStack Start plugin extracts the handler server-side and strips this import
 * from the client bundle. A standalone module-scope helper that calls
 * `getRequest` would leak `@tanstack/react-start/server` into client code (it's
 * imported transitively by routes) and trip the import-protection plugin.
 */
export const getServerSession = createServerFn({ method: 'GET' }).handler(() =>
  auth.api.getSession({ headers: getRequest().headers }),
)

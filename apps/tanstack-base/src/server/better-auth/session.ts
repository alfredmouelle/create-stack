import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '.'

/** Raw session lookup from the current request headers (server-side). */
export const getSession = async () => auth.api.getSession({ headers: getRequest().headers })

/** Server-function wrapper for route loaders / `beforeLoad`. */
export const getServerSession = createServerFn({ method: 'GET' }).handler(() => getSession())

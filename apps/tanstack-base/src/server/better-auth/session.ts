import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '.'

export const getServerSession = createServerFn({ method: 'GET' }).handler(() =>
  auth.api.getSession({ headers: getRequest().headers }),
)

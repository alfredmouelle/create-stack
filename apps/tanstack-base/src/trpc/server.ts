import { getRequest } from '@tanstack/react-start/server'
import { createCaller } from '~/server/api/root'
import { createTRPCContext } from '~/server/api/trpc'

export const getServerCaller = async () => {
  const request = getRequest()

  const context = await createTRPCContext({ headers: request.headers })

  return createCaller(context)
}

import { makeFunctionReference } from 'convex/server'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api as generated } from '../../convex/_generated/api.js'

export const api = {
  messages: {
    list: makeFunctionReference<'query', FunctionArgs<typeof generated.messages.list>, FunctionReturnType<typeof generated.messages.list>>('messages:list'),
    send: makeFunctionReference<'mutation', FunctionArgs<typeof generated.messages.send>, FunctionReturnType<typeof generated.messages.send>>('messages:send'),
  },
}

import { auth } from '~/server/better-auth'

export function GET({ request }: { readonly request: Request }): Promise<Response> {
  return auth.handler(request)
}

export const POST = GET

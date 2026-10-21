import { auth } from '~/server/clerk'

export async function GET({ request }: { readonly request: Request }): Promise<Response> {
  const session = await auth(request.headers)
  return session.userId ? Response.json(session) : Response.json(null, { status: 401 })
}

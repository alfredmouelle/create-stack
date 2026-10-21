import { env } from '~/env'

export function GET(): Response {
  return Response.json({
    google:
      env.BETTER_AUTH_GOOGLE_CLIENT_ID !== undefined &&
      env.BETTER_AUTH_GOOGLE_CLIENT_ID !== '' &&
      env.BETTER_AUTH_GOOGLE_CLIENT_SECRET !== undefined &&
      env.BETTER_AUTH_GOOGLE_CLIENT_SECRET !== '',
  })
}

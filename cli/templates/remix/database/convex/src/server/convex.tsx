import * as v from 'valibot'
import { ConvexDemo } from '../client/convex.tsx'
import { renderPage } from '../render.tsx'

export function renderConvexDemo(request: Request): Promise<Response> {
  const url = v.parse(v.pipe(v.string(), v.url()), process.env.CONVEX_URL)
  return renderPage(request, 'Messages', <ConvexDemo url={url} tokenEndpoint={__TOKEN_ENDPOINT__} />)
}

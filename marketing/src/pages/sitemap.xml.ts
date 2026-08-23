import type { APIRoute } from 'astro'
import { getBuildSiteMetadata } from '../lib/site-metadata'

export const prerender = true

export const GET: APIRoute = () => {
  const metadata = getBuildSiteMetadata(
    import.meta.env.MODE,
    import.meta.env.PUBLIC_MARKETING_BUILD_MODE,
  )

  return new Response(metadata.sitemap, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}

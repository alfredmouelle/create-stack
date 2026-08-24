import type { APIRoute } from 'astro'
import { getSiteMetadata } from '../lib/site-metadata'

export const prerender = true

export const GET: APIRoute = () => {
  const metadata = getSiteMetadata()

  return new Response(metadata.llms, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

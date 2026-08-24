export const PUBLIC_SITE_ORIGIN = 'https://create-stack.alfredmouelle.com'

export const SITE_TITLE = 'Create Stack. A real app wired around your choices'
export const SITE_DESCRIPTION =
  'Create Stack generates a working SaaS project from your choices. It wires the selected pieces together and removes the rest.'
export const SITE_NAME = 'create-stack'
export const OG_IMAGE_PATH = '/og-image.png'
export const OG_IMAGE_ALT = 'Create Stack. A real app wired around your choices'

export interface SiteMetadata {
  canonicalUrl: string
  llms: string
  ogImageUrl: string
  robots: string
  sitemap: string
}

export function getSiteMetadata(): SiteMetadata {
  const canonicalUrl = `${PUBLIC_SITE_ORIGIN}/`
  const sitemapUrl = `${PUBLIC_SITE_ORIGIN}/sitemap.xml`

  return {
    canonicalUrl,
    ogImageUrl: `${PUBLIC_SITE_ORIGIN}${OG_IMAGE_PATH}`,
    robots: `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${canonicalUrl}</loc>\n  </url>\n</urlset>\n`,
    llms: `# Create Stack\n\nCreate Stack generates a SaaS project from your choices. It supports Next.js and TanStack Start.\nDatabase, authentication, email, and other infrastructure capabilities use replaceable providers.\n\nStart with \`pnpm dlx @alfredmouelle/create-stack@latest my-app\`.\n\nWebsite: ${canonicalUrl}\nRepository: https://github.com/alfredmouelle/create-stack\n`,
  }
}

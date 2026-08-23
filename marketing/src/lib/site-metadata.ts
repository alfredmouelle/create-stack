export const PUBLIC_SITE_ORIGIN = 'https://create-stack.alfredmouelle.com'

export const SITE_TITLE = 'Create Stack. A real app wired around your choices'
export const SITE_DESCRIPTION =
  'Create Stack generates a working SaaS project from your choices. It wires the selected pieces together and removes the rest.'
export const SITE_NAME = 'create-stack'
export const OG_IMAGE_PATH = '/og-image.png'
export const OG_IMAGE_ALT = 'Create Stack. A real app wired around your choices'

export type MarketingBuildMode = 'public' | 'validation'

export interface SiteMetadata {
  canonicalUrl: string
  indexable: boolean
  llms: string
  ogImageUrl: string
  robots: string
  sitemap: string
}

export function resolveBuildMode(mode: string): MarketingBuildMode {
  if (mode === 'validation') return 'validation'
  if (mode === 'public' || mode === 'production' || mode === 'development') return 'public'

  throw new Error(`Unknown marketing build mode: ${mode}. Use "public" or "validation".`)
}

export function getSiteMetadata(mode: MarketingBuildMode): SiteMetadata {
  const indexable = mode === 'public'
  const canonicalUrl = `${PUBLIC_SITE_ORIGIN}/`
  const sitemapUrl = `${PUBLIC_SITE_ORIGIN}/sitemap.xml`

  return {
    canonicalUrl,
    indexable,
    ogImageUrl: `${PUBLIC_SITE_ORIGIN}${OG_IMAGE_PATH}`,
    robots: indexable
      ? `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`
      : 'User-agent: *\nDisallow: /\n',
    sitemap: indexable
      ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${canonicalUrl}</loc>\n  </url>\n</urlset>\n`
      : `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />\n`,
    llms: `# Create Stack\n\nCreate Stack generates a SaaS project from your choices. It supports Next.js and TanStack Start.\nDatabase, authentication, email, and other infrastructure capabilities use replaceable providers.\n\nStart with \`pnpm dlx @alfredmouelle/create-stack@latest my-app\`.\n\nWebsite: ${canonicalUrl}\nRepository: https://github.com/alfredmouelle/create-stack\nInspired by create-t3-app by Theo Browne.\n`,
  }
}

export function getBuildSiteMetadata(mode: string, testMode?: string) {
  return getSiteMetadata(resolveBuildMode(mode === 'test' ? (testMode ?? mode) : mode))
}

export const PUBLIC_SITE_ORIGIN = 'https://create-stack.alfredmouelle.com'
export const REPOSITORY_URL = 'https://github.com/alfredmouelle/create-stack'
export const NPM_URL = 'https://www.npmjs.com/package/@alfredmouelle/create-stack'

export const SITE_TITLE = 'create-stack. Your first commit is green'
export const SITE_DESCRIPTION =
  'create-stack assembles your project from a tested reference application, then makes the first commit only after install, format, typecheck and lint pass.'
export const SITE_NAME = 'create-stack'
export const OG_IMAGE_PATH = '/og-image.png'
export const OG_IMAGE_ALT = 'create-stack. Your first commit is green'

export const SITE_PAGES = ['/', '/build', '/frameworks', '/contribute', '/changelog', '/privacy']

export interface SiteMetadata {
  canonicalUrl: string
  llms: string
  ogImageUrl: string
  robots: string
  sitemap: string
}

const LLMS = (canonicalUrl: string) => `# Create Stack

Create Stack assembles a project from the selected parts of a framework's tested reference application.
Before the first Git commit it runs install, format, typecheck and lint, and it commits only when all four pass.
Next.js and TanStack Start are stable. Remix, RasenganJS, Vue, NestJS and PHP frameworks are planned, not installable.

Start with \`pnpm dlx @alfredmouelle/create-stack@latest my-app\`.

## Non-interactive use

- \`--yes\` accepts every default without a prompt. Any stack or capability flag also switches to non-interactive mode.
- \`--framework tanstack|next\`, \`--database drizzle|prisma|convex|none\`, \`--auth better-auth|clerk|none\`.
- \`--trpc\` / \`--no-trpc\`, \`--mailer resend|brevo|ses|none\`, \`--formatter biome|prettier\`, \`--linter biome|oxlint\`.
- \`--monorepo turbo|nx\`, \`--alias <prefix>\`, \`--pm pnpm|npm|yarn|bun\`, \`--no-install\`, \`--no-git\`.
- Capabilities: \`--storage\`, \`--cache\`, \`--logger\`, \`--analytics\`, \`--jobs\`, \`--errors\`.
- A choice the framework does not support is reported as a conflict before any file is written. Nothing is substituted.

After creation, \`create-stack add --with kind[=provider] [...]\` adds capabilities as a validated batch.

Website: ${canonicalUrl}
Stack builder: ${canonicalUrl}build
Repository: ${REPOSITORY_URL}
`

export function getSiteMetadata(): SiteMetadata {
  const canonicalUrl = `${PUBLIC_SITE_ORIGIN}/`
  const sitemapUrl = `${PUBLIC_SITE_ORIGIN}/sitemap.xml`
  const urls = SITE_PAGES.map(
    (path) => `  <url>\n    <loc>${PUBLIC_SITE_ORIGIN}${path}</loc>\n  </url>`,
  ).join('\n')

  return {
    canonicalUrl,
    ogImageUrl: `${PUBLIC_SITE_ORIGIN}${OG_IMAGE_PATH}`,
    robots: `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`,
    sitemap: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    llms: LLMS(canonicalUrl),
  }
}

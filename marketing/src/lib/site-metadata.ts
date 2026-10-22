import {
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  type FrameworkMaturity,
  SCAFFOLD_FLAGS,
  type ScaffoldFlag,
} from '@alfredmouelle/stack-config'
import { PLANNED_FRAMEWORKS } from '../data/frameworks'
import { SITE_NAME, SITE_TITLE } from './site-identity'

export { SITE_NAME, SITE_TITLE }

export const PUBLIC_SITE_ORIGIN = 'https://create-stack.alfredmouelle.com'
export const REPOSITORY_URL = 'https://github.com/alfredmouelle/create-stack'
export const NPM_URL = 'https://www.npmjs.com/package/@alfredmouelle/create-stack'

export const SITE_DESCRIPTION =
  'Start with a working app in the stack you choose. Strict TypeScript, formatting and linting are configured from day one.'
export const OG_IMAGE_PATH = '/og-image.png'
export const OG_IMAGE_ALT = SITE_TITLE

export const SITE_PAGES = [
  '/',
  '/build',
  '/docs',
  '/frameworks',
  '/contribute',
  '/changelog',
  '/privacy',
]

export interface SiteMetadata {
  canonicalUrl: string
  llms: string
  ogImageUrl: string
  robots: string
  sitemap: string
}

const list = new Intl.ListFormat('en', { type: 'conjunction' })

function frameworkLabels(maturity: FrameworkMaturity): string[] {
  return FRAMEWORKS.filter((id) => FRAMEWORK_SUPPORT[id].maturity === maturity).map(
    (id) => FRAMEWORK_SUPPORT[id].label,
  )
}

function maturitySentence(labels: readonly string[], state: string): string {
  if (labels.length === 0) return ''
  return `${list.format(labels)} ${labels.length === 1 ? 'is' : 'are'} ${state}.`
}

const FRAMEWORK_MATURITY = [
  maturitySentence(frameworkLabels('stable'), 'stable'),
  maturitySentence(frameworkLabels('preview'), 'in preview'),
  maturitySentence(
    PLANNED_FRAMEWORKS.map(({ label }) => label),
    'planned, not installable',
  ),
]
  .filter(Boolean)
  .join(' ')

function flagUsage({ name, negation, value }: ScaffoldFlag): string {
  const usage =
    value.kind === 'choice'
      ? `--${name} ${value.choices.join('|')}`
      : value.kind === 'text'
        ? `--${name} <${value.placeholder}>`
        : `--${name}`
  return negation === undefined ? `\`${usage}\`` : `\`${usage}\` / \`--${negation}\``
}

const flagUsages = (section: ScaffoldFlag['section']): string =>
  SCAFFOLD_FLAGS.filter((flag) => flag.section === section)
    .map(flagUsage)
    .join(', ')

const LLMS = (canonicalUrl: string) => `# Create Stack

Create Stack assembles a project from the selected parts of a framework's tested reference application.
Before the first Git commit it runs install, format, typecheck and lint, and it commits only when all four pass.
${FRAMEWORK_MATURITY}

Start with \`pnpm dlx @alfredmouelle/create-stack@latest my-app\`.

## Non-interactive use

- \`--yes\` accepts every default without a prompt. Any stack or capability flag also switches to non-interactive mode.
- Stack: ${flagUsages('stack')}.
- Capabilities, where a bare flag selects the recommended provider: ${flagUsages('capability')}.
- Project: ${flagUsages('project')}.
- A choice the framework does not support is reported as a conflict before any file is written. Nothing is substituted.

After creation, \`create-stack add --with kind[=provider] [...]\` adds capabilities as a validated batch.

Website: ${canonicalUrl}
Stack builder: ${canonicalUrl}build
Docs: ${canonicalUrl}docs
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

import { describe, expect, it } from 'vitest'
import { CLI_RELEASE, RELEASE_FLAGS as SCAFFOLD_FLAGS } from './cli-release'
import { getSiteMetadata } from './site-metadata'

const { llms } = getSiteMetadata()

describe('llms.txt', () => {
  it.each(SCAFFOLD_FLAGS)('mentions --$name', ({ name, negation }) => {
    expect(llms).toContain(`\`--${name}`)
    if (negation !== undefined) expect(llms).toContain(`\`--${negation}\``)
  })

  it.each([
    CLI_RELEASE.frameworks.remix
      ? '`--framework tanstack|next|rasengan|remix`'
      : '`--framework tanstack|next|rasengan`',
    '`--trpc` / `--no-trpc`',
    '`--database drizzle|prisma|convex|none` / `--no-db`',
    '`--errors sentry`',
    '`--alias <prefix>`',
    '`--yes`',
  ])('formats %s', (usage) => {
    expect(llms).toContain(usage)
  })

  it('states framework maturity from the shared support catalog', () => {
    expect(llms).toContain(
      CLI_RELEASE.frameworks.remix
        ? 'TanStack Start and Next.js are stable. RasenganJS and Remix are in preview. Vue, NestJS, and PHP frameworks are planned, not installable.'
        : 'TanStack Start and Next.js are stable. RasenganJS is in preview. Remix is coming in the next release, not installable. Vue, NestJS, and PHP frameworks are planned, not installable.',
    )
  })
})

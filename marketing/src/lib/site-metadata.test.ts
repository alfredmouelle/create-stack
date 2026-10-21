import { SCAFFOLD_FLAGS } from '@alfredmouelle/stack-config'
import { describe, expect, it } from 'vitest'
import { getSiteMetadata } from './site-metadata'

const { llms } = getSiteMetadata()

describe('llms.txt', () => {
  it.each(SCAFFOLD_FLAGS)('mentions --$name', ({ name, negation }) => {
    expect(llms).toContain(`\`--${name}`)
    if (negation !== undefined) expect(llms).toContain(`\`--${negation}\``)
  })

  it.each([
    '`--framework tanstack|next|rasengan`',
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
      'TanStack Start and Next.js are stable. RasenganJS is in preview. Remix, Vue, NestJS, and PHP frameworks are planned, not installable.',
    )
  })
})

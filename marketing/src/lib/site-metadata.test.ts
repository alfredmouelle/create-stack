import {
  AUTHS,
  CAPABILITY_CATALOG,
  DATABASES,
  FORMATTERS,
  FRAMEWORKS,
  LINTERS,
  MAILERS,
  MONOREPO_ORCHESTRATORS,
  PACKAGE_MANAGERS,
} from '@alfredmouelle/stack-config'
import { describe, expect, it } from 'vitest'
import { getSiteMetadata } from './site-metadata'

const { llms } = getSiteMetadata()

describe('llms.txt', () => {
  it.each([
    ['--framework', FRAMEWORKS],
    ['--database', DATABASES],
    ['--auth', AUTHS],
    ['--mailer', MAILERS],
    ['--formatter', FORMATTERS],
    ['--linter', LINTERS],
    ['--monorepo', MONOREPO_ORCHESTRATORS],
    ['--pm', PACKAGE_MANAGERS],
  ])('lists every %s value the CLI accepts', (flag, values) => {
    expect(llms).toContain(`\`${flag} ${values.join('|')}\``)
  })

  it.each(CAPABILITY_CATALOG)('lists the --$flag capability flag', ({ flag }) => {
    expect(llms).toContain(`\`--${flag}\``)
  })

  it('states framework maturity from the shared support catalog', () => {
    expect(llms).toContain(
      'TanStack Start and Next.js are stable. RasenganJS is in preview. Remix, Vue, NestJS, and PHP frameworks are planned, not installable.',
    )
  })

  it.each(['--yes', '--trpc', '--no-trpc', '--alias <prefix>', '--no-install', '--no-git'])(
    'mentions the %s flag',
    (flag) => {
      expect(llms).toContain(`\`${flag}\``)
    },
  )
})

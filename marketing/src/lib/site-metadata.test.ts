import {
  AUTHS,
  CAPABILITY_CATALOG,
  DATABASES,
  FORMATTERS,
  FRAMEWORK_SUPPORT,
  FRAMEWORKS,
  type FrameworkMaturity,
  LINTERS,
  MAILERS,
  MONOREPO_ORCHESTRATORS,
  PACKAGE_MANAGERS,
} from '@alfredmouelle/stack-config'
import { describe, expect, it } from 'vitest'
import { PLANNED_FRAMEWORKS } from '../data/frameworks'
import { getSiteMetadata } from './site-metadata'

const { llms } = getSiteMetadata()
const list = new Intl.ListFormat('en', { type: 'conjunction' })

function labels(maturity: FrameworkMaturity): string[] {
  return FRAMEWORKS.filter((id) => FRAMEWORK_SUPPORT[id].maturity === maturity).map(
    (id) => FRAMEWORK_SUPPORT[id].label,
  )
}

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

  it('lists every capability flag', () => {
    for (const capability of CAPABILITY_CATALOG) {
      expect(llms).toContain(`\`--${capability.flags[0]}\``)
    }
  })

  it('states framework maturity from the shared support catalog', () => {
    for (const maturity of ['stable', 'preview'] as const) {
      expect(llms).toContain(list.format(labels(maturity)))
    }
    expect(llms).toContain(list.format(PLANNED_FRAMEWORKS.map(({ label }) => label)))
  })
})

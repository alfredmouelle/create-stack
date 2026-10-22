import { describe, expect, it } from 'vitest'
import { CLI_PACKAGE } from './cli-release'
import { installCommand } from './install-command'

describe('installCommand', () => {
  it('renders the canonical pnpm command', () => {
    expect(installCommand('pnpm')).toBe(`pnpm dlx ${CLI_PACKAGE} my-app`)
  })

  it('renders equivalent commands for the other supported package managers', () => {
    expect(installCommand('npm')).toBe(`npx ${CLI_PACKAGE} my-app`)
    expect(installCommand('yarn')).toBe(`yarn dlx ${CLI_PACKAGE} my-app`)
    expect(installCommand('bun')).toBe(`bunx ${CLI_PACKAGE} my-app`)
  })
})

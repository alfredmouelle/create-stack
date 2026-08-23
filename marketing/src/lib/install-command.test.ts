import { describe, expect, it } from 'vitest'
import { installCommand } from './install-command'

describe('installCommand', () => {
  it('renders the canonical pnpm command', () => {
    expect(installCommand('pnpm')).toBe('pnpm dlx @alfredmouelle/create-stack@latest my-app')
  })

  it('renders equivalent commands for the other supported package managers', () => {
    expect(installCommand('npm')).toBe('npx @alfredmouelle/create-stack@latest my-app')
    expect(installCommand('yarn')).toBe('yarn dlx @alfredmouelle/create-stack@latest my-app')
    expect(installCommand('bun')).toBe('bunx @alfredmouelle/create-stack@latest my-app')
  })
})

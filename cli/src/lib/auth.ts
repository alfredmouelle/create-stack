import type { Auth } from '../../../packages/stack-config/src/index.ts'

export const AUTHS = ['better-auth', 'clerk'] as const satisfies readonly Auth[]
export const DEFAULT_AUTH = 'better-auth' satisfies Auth

export function resolveAuth(value: unknown): Auth {
  if (value === 'none') return 'none'
  if (value === true || value == null || value === '') return DEFAULT_AUTH
  const auth = AUTHS.find((candidate) => candidate === value)
  if (!auth) throw new Error(`Unknown auth: ${value} (have ${AUTHS.join(', ')}, none)`)
  return auth
}

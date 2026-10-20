export const AUTHS = ['better-auth', 'clerk']
export const DEFAULT_AUTH = 'better-auth'

export function resolveAuth(value) {
  if (value === 'none') return 'none'
  if (value === true || value == null || value === '') return DEFAULT_AUTH
  if (!AUTHS.includes(value)) {
    throw new Error(`Unknown auth: ${value} (have ${AUTHS.join(', ')}, none)`)
  }
  return value
}

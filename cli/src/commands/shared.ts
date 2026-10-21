import { CAPABILITY_CATALOG, scaffoldFlag } from '@alfredmouelle/stack-config'
import * as p from '@clack/prompts'

export function cancelled<Value>(value: Value | typeof p.CANCEL_SYMBOL): Value {
  if (p.isCancel(value)) {
    p.cancel('Aborted.')
    process.exit(0)
  }
  return value
}

export function flagChoices(name: string): string {
  const { value } = scaffoldFlag(name)
  return value.kind === 'choice' ? value.choices.join('|') : ''
}

export const helpLine = (usage: string, description: string): string =>
  `${usage.padEnd(34)} ${description}`

export const PORT_CAPABILITIES = CAPABILITY_CATALOG.filter(({ kind }) => kind === 'port')
export const MODULE_CAPABILITIES = CAPABILITY_CATALOG.filter(({ kind }) => kind === 'module')

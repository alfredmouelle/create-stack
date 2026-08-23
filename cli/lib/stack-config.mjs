import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = resolve(fileURLToPath(new URL('.', import.meta.url)))
const bundled = resolve(here, '../_stack/stack-config/index.mjs')
const workspaceSource = resolve(here, '../../packages/stack-config/src/index.ts')
const sharedModule = await import(
  pathToFileURL(existsSync(bundled) ? bundled : workspaceSource).href
)

export const { resolveStackConfiguration } = sharedModule

export function resolveCreationConfiguration(input = {}) {
  const result = resolveStackConfiguration(input)
  if (result.conflicts.length > 0) {
    throw new Error(result.conflicts.map((conflict) => conflict.message).join('; '))
  }

  return {
    ...result.configuration,
    mailerProvider: result.configuration.mailer,
    selectionReasons: Object.fromEntries(
      result.reasons.map((reason) => [reason.axis, reason.message]),
    ),
  }
}

// Pure build phase (no prompts/install): fork → strip → mailer → env → identity.
// Shared by index.mjs (post-wizard) and the test harness.

import { vendorCapability } from './capabilities.mjs'
import { writeEnv } from './env.mjs'
import { stampIdentity } from './identity.mjs'
import { swapMailer } from './mailer.mjs'
import { forkBase, makeStandalone } from './scaffold.mjs'
import { stripFoundations } from './strip.mjs'
import { join, pkgAddDeps, pkgRemoveDeps, pkgRemoveScripts, readJSON, writeJSON } from './util.mjs'

/**
 * @param {object} o
 * @param {string} o.projectDir  absolute target dir (must be empty)
 * @param {string} o.projectName
 * @param {'next'|'tanstack'} o.framework
 * @param {Set<string>} o.kept   foundations to keep (deps pre-resolved)
 * @param {'resend'|'brevo'|'ses'|'none'} o.mailerProvider
 * @param {Record<string,string>} [o.capabilities]  capability → adapter (e.g. { storage: 's3' })
 * @returns {{ kept: string[], keptMailer: boolean, mailerProvider: string, capabilities: Record<string,string>, envKeys: string[] }}
 */
export function buildProject({
  projectDir,
  projectName,
  framework,
  kept,
  mailerProvider,
  capabilities = {},
}) {
  const authKept = kept.has('better-auth')
  const keptMailer = mailerProvider !== 'none'

  forkBase(framework, projectDir)
  makeStandalone(projectDir, projectName, framework)

  const strip = stripFoundations({ projectDir, framework, kept, keptMailer })
  const mailer = keptMailer
    ? swapMailer(projectDir, mailerProvider)
    : { addDeps: {}, removeDeps: [], envKeys: [] }

  // vendor each selected capability (core + adapter + composition root) into the fork.
  const capAddDeps = {}
  const capEnvKeys = []
  for (const [cap, adapter] of Object.entries(capabilities)) {
    const r = vendorCapability({ projectDir, framework, projectName, cap, adapter })
    Object.assign(capAddDeps, r.addDeps)
    capEnvKeys.push(...r.envKeys)
  }

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.description = `${projectName} — scaffolded from the personal reference stack.`
  pkgRemoveDeps(pkg, [...strip.removeDeps, ...mailer.removeDeps])
  pkgRemoveScripts(pkg, strip.removeScripts)
  pkgAddDeps(pkg, { ...mailer.addDeps, ...capAddDeps })
  writeJSON(pkgPath, pkg)

  const envKeys = []
  if (kept.has('drizzle')) envKeys.push('DATABASE_URL')
  if (authKept) {
    envKeys.push(
      'BETTER_AUTH_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_GOOGLE_CLIENT_ID',
      'BETTER_AUTH_GOOGLE_CLIENT_SECRET',
    )
  }
  envKeys.push(...mailer.envKeys, ...capEnvKeys)
  writeEnv(projectDir, envKeys)

  stampIdentity(projectDir, projectName, framework)

  return { kept: [...kept], keptMailer, mailerProvider, capabilities, envKeys }
}

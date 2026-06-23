// Pure build phase (no prompts/install): fork → strip → mailer → env → identity.
// Shared by index.mjs (post-wizard) and the test harness.

import { vendorCapability } from './capabilities.mjs'
import { writeEnv } from './env.mjs'
import { stampIdentity } from './identity.mjs'
import { swapMailer } from './mailer.mjs'
import { detectPackageManager } from './package-manager.mjs'
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
 * @param {import('./package-manager.mjs').PackageManager} [o.pm]  target package manager (defaults to detected)
 * @returns {{ kept: string[], keptMailer: boolean, mailerProvider: string, capabilities: Record<string,string>, envKeys: string[] }}
 */
export function buildProject({
  projectDir,
  projectName,
  framework,
  kept,
  mailerProvider,
  capabilities = {},
  pm = detectPackageManager(),
}) {
  const authKept = kept.has('better-auth')
  const keptMailer = mailerProvider !== 'none'

  forkBase(framework, projectDir)
  makeStandalone(projectDir, projectName, framework, pm)

  const strip = stripFoundations({ projectDir, framework, kept, keptMailer })
  const mailer = keptMailer
    ? swapMailer(projectDir, mailerProvider)
    : { addDeps: {}, removeDeps: [], envKeys: [], requiredEnvKeys: [] }

  // vendor each selected capability (core + adapter + composition root) into the fork.
  const capAddDeps = {}
  const capEnvKeys = []
  const capRequiredEnvKeys = []
  for (const [cap, adapter] of Object.entries(capabilities)) {
    const r = vendorCapability({ projectDir, framework, projectName, cap, adapter })
    Object.assign(capAddDeps, r.addDeps)
    capEnvKeys.push(...r.envKeys)
    capRequiredEnvKeys.push(...r.requiredEnvKeys)
  }

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.description = `${projectName} — scaffolded from the personal reference stack.`
  pkgRemoveDeps(pkg, [...strip.removeDeps, ...mailer.removeDeps])
  pkgRemoveScripts(pkg, strip.removeScripts)
  pkgAddDeps(pkg, { ...mailer.addDeps, ...capAddDeps })
  writeJSON(pkgPath, pkg)

  const envKeys = []
  const requiredEnvKeys = []
  if (kept.has('drizzle')) {
    envKeys.push('DATABASE_URL')
    requiredEnvKeys.push('DATABASE_URL')
  }
  if (authKept) {
    envKeys.push(
      'BETTER_AUTH_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_GOOGLE_CLIENT_ID', // Google OAuth is opt-in → optional
      'BETTER_AUTH_GOOGLE_CLIENT_SECRET',
    )
    requiredEnvKeys.push('BETTER_AUTH_URL', 'BETTER_AUTH_SECRET')
  }
  envKeys.push(...mailer.envKeys, ...capEnvKeys)
  requiredEnvKeys.push(...mailer.requiredEnvKeys, ...capRequiredEnvKeys)
  writeEnv(projectDir, envKeys, requiredEnvKeys)

  stampIdentity(projectDir, projectName, framework, pm)

  return { kept: [...kept], keptMailer, mailerProvider, capabilities, envKeys }
}

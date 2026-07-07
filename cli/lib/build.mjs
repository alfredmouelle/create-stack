// Pure build phase (no prompts/install): fork → strip → mailer → env → identity.
// Shared by index.mjs (post-wizard) and the test harness.

import { rewriteAlias } from './alias.mjs'
import { applyAuth } from './auth.mjs'
import { vendorCapability } from './capabilities.mjs'
import { allComponentDeps, allComponentFiles } from './component.mjs'
import { applyDatabase } from './database.mjs'
import { appendRawEnvLines, writeEnv } from './env.mjs'
import { stampIdentity } from './identity.mjs'
import { swapMailer } from './mailer.mjs'
import { detectPackageManager } from './package-manager.mjs'
import { forkBase, makeStandalone } from './scaffold.mjs'
import { stripFoundations } from './strip.mjs'
import {
  join,
  pkgAddDeps,
  pkgRemoveDeps,
  pkgRemoveScripts,
  readJSON,
  remove,
  writeJSON,
} from './util.mjs'

/**
 * @param {object} o
 * @param {string} o.projectDir  absolute target dir (must be empty)
 * @param {string} o.projectName
 * @param {'next'|'tanstack'} o.framework
 * @param {Set<string>} o.kept   foundations to keep (deps pre-resolved)
 * @param {'drizzle'|'prisma'|'none'} o.database  ORM the app ships (default 'drizzle')
 * @param {'better-auth'|'clerk'|'none'} o.auth  auth provider (default 'better-auth')
 * @param {'resend'|'brevo'|'ses'|'none'} o.mailerProvider
 * @param {Record<string,string>} [o.capabilities]  capability → adapter (e.g. { storage: 's3' })
 * @param {string} [o.alias]  import-alias prefix to rewrite '~/' to (default '~', i.e. no-op)
 * @param {import('./package-manager.mjs').PackageManager} [o.pm]  target package manager (defaults to detected)
 * @returns {{ kept: string[], keptMailer: boolean, mailerProvider: string, capabilities: Record<string,string>, envKeys: string[], alias: string }}
 */
export function buildProject({
  projectDir,
  projectName,
  framework,
  kept,
  database = 'drizzle',
  auth = 'better-auth',
  mailerProvider,
  capabilities = {},
  alias = '~',
  pm = detectPackageManager(),
}) {
  const authUsesDb = auth === 'better-auth'
  const keptMailer = mailerProvider !== 'none'

  forkBase(framework, projectDir)
  makeStandalone(projectDir, projectName, framework, pm)

  // strip → auth → database: stripFoundations may swap the app shell (no-trpc variants)
  // that applyAuth then injects the provider into; applyDatabase keys its auth models on auth.
  const strip = stripFoundations({ projectDir, framework, kept, keptMailer })
  const authRes = applyAuth({ projectDir, framework, auth, trpcKept: kept.has('trpc') })
  const db = applyDatabase({ projectDir, database, authKept: authUsesDb })

  // opt-in components never ship in the default bundle — strip them; re-add via
  // `create-stack component <name>`.
  for (const rel of allComponentFiles()) remove(join(projectDir, rel))
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
  pkgRemoveDeps(pkg, [
    ...strip.removeDeps,
    ...mailer.removeDeps,
    ...allComponentDeps(),
    ...db.removeDeps,
    ...authRes.removeDeps,
  ])
  pkgRemoveScripts(pkg, [...strip.removeScripts, ...db.removeScripts])
  pkgAddDeps(pkg, { ...mailer.addDeps, ...capAddDeps, ...db.addDeps, ...authRes.addDeps })
  pkgAddDeps(pkg, db.addDevDeps, 'devDependencies')
  if (Object.keys(db.setScripts).length) pkg.scripts = { ...pkg.scripts, ...db.setScripts }
  writeJSON(pkgPath, pkg)

  const envKeys = []
  const requiredEnvKeys = []
  if (database !== 'none') {
    envKeys.push('DATABASE_URL')
    requiredEnvKeys.push('DATABASE_URL')
  }
  if (auth === 'better-auth') {
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
  // Clerk reads its keys straight from the environment (not the typed env.ts).
  if (authRes.envLines.length) appendRawEnvLines(projectDir, authRes.envLines)

  stampIdentity(projectDir, projectName, framework, pm)

  // last: swap '~/' for the chosen alias across everything generated above (no-op when '~').
  rewriteAlias(projectDir, alias)

  return {
    kept: [...kept],
    database,
    auth,
    keptMailer,
    mailerProvider,
    capabilities,
    envKeys,
    alias,
  }
}

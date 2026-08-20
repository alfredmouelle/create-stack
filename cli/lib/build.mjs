import { randomBytes } from 'node:crypto'
import { rewriteAlias } from './alias.mjs'
import { applyAuth } from './auth.mjs'
import { MANUAL_STEPS, vendorCapability } from './capabilities.mjs'
import { writeCiWorkflow } from './ci.mjs'
import { allComponentDeps, allComponentFiles } from './component.mjs'
import { applyDatabase } from './database.mjs'
import { appendRawEnvLines, writeEnv } from './env.mjs'
import { stampIdentity } from './identity.mjs'
import { swapMailer } from './mailer.mjs'
import { wrapMonorepo } from './monorepo.mjs'
import { detectPackageManager } from './package-manager.mjs'
import { forkBase, makeStandalone } from './scaffold.mjs'
import { stripUnselectedFeatures } from './strip.mjs'
import {
  join,
  pkgAddDeps,
  pkgRemoveDeps,
  pkgRemoveScripts,
  readJSON,
  remove,
  writeJSON,
} from './util.mjs'

export function buildProject({
  projectDir,
  projectName,
  framework,
  trpc,
  database = 'drizzle',
  auth = 'better-auth',
  mailerProvider,
  capabilities = {},
  alias = '~',
  monorepo = false,
  pm = detectPackageManager(),
}) {
  const authUsesDb = auth === 'better-auth'
  const keptMailer = mailerProvider !== 'none'
  const appDir = monorepo ? join(projectDir, 'apps', 'web') : projectDir

  forkBase(framework, appDir)
  makeStandalone(appDir, monorepo ? 'web' : projectName, framework, pm, { monorepo: !!monorepo })

  const strip = stripUnselectedFeatures({ projectDir: appDir, framework, trpc, keptMailer })
  const authRes = applyAuth({ projectDir: appDir, framework, auth, trpcKept: trpc })
  const db = applyDatabase({ projectDir: appDir, database, framework, auth, authKept: authUsesDb })

  for (const rel of allComponentFiles()) remove(join(appDir, rel))
  const mailer = keptMailer
    ? swapMailer(appDir, mailerProvider)
    : { addDeps: {}, removeDeps: [], envKeys: [], requiredEnvKeys: [] }

  const capAddDeps = {}
  const capEnvKeys = []
  const capRequiredEnvKeys = []
  for (const [cap, adapter] of Object.entries(capabilities)) {
    const r = vendorCapability({ projectDir: appDir, framework, projectName, cap, adapter })
    Object.assign(capAddDeps, r.addDeps)
    capEnvKeys.push(...r.envKeys)
    capRequiredEnvKeys.push(...r.requiredEnvKeys)
  }

  const pkgPath = join(appDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.description = `${projectName}: a fully-wired app scaffolded with create-stack.`
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
  if (database !== 'none' && database !== 'convex') {
    envKeys.push('DATABASE_URL')
    requiredEnvKeys.push('DATABASE_URL')
  }
  if (auth === 'better-auth') {
    envKeys.push(
      'BETTER_AUTH_URL',
      'BETTER_AUTH_SECRET',
      'BETTER_AUTH_GOOGLE_CLIENT_ID',
      'BETTER_AUTH_GOOGLE_CLIENT_SECRET',
    )
    requiredEnvKeys.push('BETTER_AUTH_URL', 'BETTER_AUTH_SECRET')
  }
  envKeys.push(...mailer.envKeys, ...capEnvKeys)
  requiredEnvKeys.push(...mailer.requiredEnvKeys, ...capRequiredEnvKeys)
  const localEnv =
    auth === 'better-auth' ? { BETTER_AUTH_SECRET: randomBytes(32).toString('base64url') } : {}
  writeEnv(appDir, envKeys, requiredEnvKeys, localEnv)
  const rawEnvLines = [...authRes.envLines, ...(db.envLines ?? [])]
  if (rawEnvLines.length) appendRawEnvLines(appDir, rawEnvLines)

  stampIdentity(appDir, projectName, framework, pm)
  writeCiWorkflow(projectDir, pm)

  rewriteAlias(appDir, alias)

  if (monorepo)
    wrapMonorepo({
      rootDir: projectDir,
      appDir,
      projectName,
      framework,
      pm,
      tool: monorepo,
      appNativeBuilds: db.nativeBuilds,
    })

  return {
    manualSteps: Object.keys(capabilities).flatMap((cap) =>
      (MANUAL_STEPS[cap]?.[framework] ?? []).map((step) => `${cap}: ${step}`),
    ),
    trpc,
    database,
    auth,
    keptMailer,
    mailerProvider,
    capabilities,
    envKeys,
    alias,
    monorepo,
  }
}

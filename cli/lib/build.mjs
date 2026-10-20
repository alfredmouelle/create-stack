import { randomBytes } from 'node:crypto'
import { rewriteAlias } from './alias.mjs'
import { writeCiWorkflow } from './ci.mjs'
import {
  isSqlDatabase,
  localDatabaseUrl,
  localTestDatabaseUrl,
  writeDatabaseScript,
} from './database.mjs'
import { assembleFrameworkParts, getFrameworkModule, wireCapabilityAddition } from './engine.mjs'
import { appendRawEnvLines, writeEnv } from './env.mjs'
import { creationMetadata, stampIdentity } from './identity.mjs'
import { wrapMonorepo } from './monorepo.mjs'
import { detectPackageManager } from './package-manager.mjs'
import { join, pkgAddDeps, readJSON, writeJSON } from './util.mjs'

function createLocalEnv(database, auth, projectName) {
  return {
    ...(isSqlDatabase(database) ? { DATABASE_URL: localDatabaseUrl(projectName) } : {}),
    ...(auth === 'better-auth'
      ? { BETTER_AUTH_SECRET: randomBytes(32).toString('base64url') }
      : {}),
  }
}

function createTestEnv(database, projectName) {
  return isSqlDatabase(database) ? { DATABASE_URL: localTestDatabaseUrl(projectName) } : null
}

function writeLocalDatabaseScript(projectDir, database, monorepo) {
  if (!isSqlDatabase(database)) return
  writeDatabaseScript({
    projectDir,
    envPath: monorepo ? 'apps/web/.env' : '.env',
  })
}

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
  const hasDatabaseSchema = database === 'prisma' || (database === 'drizzle' && authUsesDb)
  const keptMailer = mailerProvider !== 'none'
  const appDir = monorepo ? join(projectDir, 'apps', 'web') : projectDir

  const initialized = assembleFrameworkParts(framework, {
    applicationDir: appDir,
    projectName: monorepo ? 'web' : projectName,
    database,
    auth,
    trpc,
    mailer: mailerProvider,
    monorepo,
    packageManager: pm,
  })

  const capAddDeps = {}
  const capEnvKeys = []
  const capRequiredEnvKeys = []
  const manualSteps = []
  const module = getFrameworkModule(framework)
  for (const [cap, adapter] of Object.entries(capabilities)) {
    const r = wireCapabilityAddition(module, {
      projectDir: appDir,
      projectName,
      cap,
      adapter,
      keep: false,
    })
    Object.assign(capAddDeps, r.addDeps)
    capEnvKeys.push(...r.envKeys)
    capRequiredEnvKeys.push(...r.requiredEnvKeys)
    manualSteps.push(...r.manualSteps.map((step) => `${cap}: ${step}`))
  }

  const pkgPath = join(appDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkg.description = `${projectName}: a fully-wired app scaffolded with create-stack.`
  pkgAddDeps(pkg, capAddDeps)
  writeJSON(pkgPath, pkg)

  const envKeys = [...initialized.envKeys, ...capEnvKeys]
  const requiredEnvKeys = [...initialized.requiredEnvKeys, ...capRequiredEnvKeys]
  const localEnv = createLocalEnv(database, auth, projectName)
  writeEnv(appDir, envKeys, requiredEnvKeys, localEnv, createTestEnv(database, projectName))
  const rawEnvLines = initialized.envLines
  if (rawEnvLines.length) appendRawEnvLines(appDir, rawEnvLines)

  const metadata = creationMetadata()

  stampIdentity(appDir, projectName, pm, {
    hasDatabase: isSqlDatabase(database),
    hasDatabaseSchema,
    database,
    metadata,
  })
  writeCiWorkflow(projectDir, pm, monorepo ? 'apps/web/.nvmrc' : '.nvmrc')

  rewriteAlias(appDir, alias)

  if (monorepo)
    wrapMonorepo({
      rootDir: projectDir,
      appDir,
      projectName,
      framework,
      pm,
      tool: monorepo,
      database,
      hasDatabase: isSqlDatabase(database),
      hasDatabaseSchema,
      metadata,
      appNativeBuilds: initialized.nativeBuilds,
    })

  writeLocalDatabaseScript(monorepo ? projectDir : appDir, database, monorepo)

  return {
    manualSteps,
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

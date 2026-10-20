import { randomBytes } from 'node:crypto'
import type { Framework } from '../../../packages/stack-config/src/index.ts'
import { wireCapabilityAddition } from '../additions.ts'
import type { AssemblyRequest, AssemblyResult } from '../framework-module.ts'
import { getFrameworkModule } from '../framework-registry.ts'
import type { ReferenceApplication } from '../reference-application.ts'
import { assembleReferenceParts } from './project-parts.ts'

export function assembleProject(
  framework: Framework,
  reference: ReferenceApplication,
): (request: AssemblyRequest) => Promise<AssemblyResult> {
  return (request) => assembleJavaScriptProject(request, framework, reference)
}

async function assembleJavaScriptProject(
  request: AssemblyRequest,
  framework: Framework,
  reference: ReferenceApplication,
): Promise<AssemblyResult> {
  const [
    { rewriteAlias },
    { writeCiWorkflow },
    { isSqlDatabase, localDatabaseUrl, localTestDatabaseUrl, writeDatabaseScript },
    { appendRawEnvLines, writeEnv },
    { creationMetadata, packageName, stampIdentity },
    { wrapMonorepo },
    { join, pkgAddDeps, readJSON, writeJSON },
  ] = await Promise.all([
    import('#lib/alias.mjs'),
    import('#lib/ci.mjs'),
    import('#lib/database.mjs'),
    import('#lib/env.mjs'),
    import('#lib/identity.mjs'),
    import('#lib/monorepo.mjs'),
    import('#lib/util.mjs'),
  ])
  const {
    projectDir,
    database,
    auth,
    trpc,
    mailer: mailerProvider,
    capabilities,
    alias,
    monorepo,
    packageManager: pm,
  } = request
  const projectName = packageName(projectDir)
  const hasDatabase = isSqlDatabase(database)
  const localEnv = {
    ...(hasDatabase ? { DATABASE_URL: localDatabaseUrl(projectName) } : {}),
    ...(auth === 'better-auth'
      ? { BETTER_AUTH_SECRET: randomBytes(32).toString('base64url') }
      : {}),
  }
  const testEnv = hasDatabase ? { DATABASE_URL: localTestDatabaseUrl(projectName) } : null
  const authUsesDb = auth === 'better-auth'
  const hasDatabaseSchema = database === 'prisma' || (database === 'drizzle' && authUsesDb)
  const appDir = monorepo ? join(projectDir, 'apps', 'web') : projectDir

  const initialized = assembleReferenceParts(reference)({
    applicationDir: appDir,
    projectName: monorepo ? 'web' : projectName,
    database,
    auth,
    trpc,
    mailer: mailerProvider,
    monorepo,
    packageManager: pm,
  })

  const capAddDeps: Record<string, string> = {}
  const capEnvKeys: string[] = []
  const capRequiredEnvKeys: string[] = []
  const manualSteps: string[] = []
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
  writeEnv(appDir, envKeys, requiredEnvKeys, localEnv, testEnv)
  const rawEnvLines = initialized.envLines
  if (rawEnvLines.length) appendRawEnvLines(appDir, rawEnvLines)

  const metadata = creationMetadata()

  const identityOptions = {
    hasDatabase,
    hasDatabaseSchema,
    database,
    metadata,
  }
  stampIdentity(appDir, projectName, pm, identityOptions)
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
      hasDatabase,
      hasDatabaseSchema,
      metadata,
      appNativeBuilds: initialized.nativeBuilds,
    })

  if (hasDatabase)
    writeDatabaseScript({
      projectDir,
      envPath: monorepo ? 'apps/web/.env' : '.env',
    })

  return { applicationDir: appDir, manualSteps }
}

import { applyAuth } from '#lib/auth.mjs'
import { applyDatabase, isSqlDatabase } from '#lib/database.mjs'
import { swapMailer } from '#lib/mailer.mjs'
import { forkBase, makeStandalone } from '#lib/scaffold.mjs'
import { stripUnselectedFeatures } from '#lib/strip.mjs'
import { applyTesting } from '#lib/testing.mjs'
import {
  join,
  pkgAddDeps,
  pkgRemoveDeps,
  pkgRemoveScripts,
  readJSON,
  writeJSON,
} from '#lib/util.mjs'
import { declaresDependency } from '../javascript/package-manifest.ts'
import type {
  JavaScriptAssemblyRequest,
  JavaScriptAssemblyResult,
  JavaScriptFrameworkModule,
} from '../javascript/project-parts.ts'
import { packageScriptGate } from '../javascript/verification-gate.ts'
import { nextAdditions } from './next-additions.ts'
import { assembleProject } from './project-assembly.ts'

function assembleNextParts({
  applicationDir: projectDir,
  projectName,
  database,
  auth,
  trpc,
  mailer: mailerProvider,
  monorepo,
  packageManager: pm,
}: JavaScriptAssemblyRequest): JavaScriptAssemblyResult {
  const authUsesDb = auth === 'better-auth'
  const keptMailer = mailerProvider !== 'none'
  forkBase('next', projectDir)
  makeStandalone(projectDir, projectName, 'next', pm, {
    monorepo: !!monorepo,
  })

  const strip = stripUnselectedFeatures({ projectDir, framework: 'next', trpc, keptMailer })
  const authRes = applyAuth({ projectDir, framework: 'next', auth, trpcKept: trpc })
  const db = applyDatabase({ projectDir, database, framework: 'next', auth, authKept: authUsesDb })
  applyTesting({ projectDir, sqlDatabase: isSqlDatabase(database), auth, trpc })

  const mailer = keptMailer
    ? swapMailer(projectDir, mailerProvider)
    : { addDeps: {}, removeDeps: [], envKeys: [], requiredEnvKeys: [] }

  const pkgPath = join(projectDir, 'package.json')
  const pkg = readJSON(pkgPath)
  pkgRemoveDeps(pkg, [
    ...strip.removeDeps,
    ...mailer.removeDeps,
    ...db.removeDeps,
    ...authRes.removeDeps,
  ])
  pkgRemoveScripts(pkg, [...strip.removeScripts, ...db.removeScripts])
  pkgAddDeps(pkg, { ...mailer.addDeps, ...db.addDeps, ...authRes.addDeps })
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
  envKeys.push(...mailer.envKeys)
  requiredEnvKeys.push(...mailer.requiredEnvKeys)
  return {
    envKeys,
    requiredEnvKeys,
    envLines: [...authRes.envLines, ...(db.envLines ?? [])],
    nativeBuilds: db.nativeBuilds,
  }
}

export const nextModule: JavaScriptFrameworkModule = {
  id: 'next',
  detect: (applicationDir) => declaresDependency(applicationDir, ['next']),
  assemble: assembleProject('next'),
  assembleParts: assembleNextParts,
  additions: nextAdditions,
  gate: packageScriptGate,
  monorepoOutputs: ['.next/**', '!.next/cache/**'],
  packagedAssets: ['apps/next-base'],
  qualityProfileExceptions: [],
}

import { dirname, join, resolve } from 'node:path'
import { PACKAGE_MANAGERS, type PackageManagerName } from '@alfredmouelle/stack-config'
import type { PackageManager } from '../framework-module.ts'
import { isJsonObject, type JsonObject } from '../javascript/json.ts'
import { exists, readJSON } from './util.ts'

export type EffectivePackageManager = {
  readonly name: PackageManagerName
  readonly pm: PackageManager
  readonly source: string
  readonly raw?: string
}

export const isPackageManagerName = (value: unknown): value is PackageManagerName =>
  PACKAGE_MANAGERS.some((name) => name === value)

const PACKAGE_MANAGER_COMMANDS: Record<PackageManagerName, PackageManager> = {
  pnpm: {
    name: 'pnpm',
    exec: 'pnpm',
    installArgs: ['install', '--no-frozen-lockfile'],
    runArgs: (script: string) => ['--config.verify-deps-before-run=false', 'run', script],
    devCmd: 'pnpm dev',
  },
  npm: {
    name: 'npm',
    exec: 'npm',
    installArgs: ['install'],
    runArgs: (script: string) => ['run', script],
    devCmd: 'npm run dev',
  },
  yarn: {
    name: 'yarn',
    exec: 'yarn',
    installArgs: ['install'],
    runArgs: (script: string) => ['run', script],
    devCmd: 'yarn dev',
  },
  bun: {
    name: 'bun',
    exec: 'bun',
    installArgs: ['install'],
    runArgs: (script: string) => ['run', script],
    devCmd: 'bun dev',
  },
}

export const PM_VERSIONS: Record<PackageManagerName, string> = {
  pnpm: '11.1.3',
  npm: '11.0.0',
  yarn: '4.18.1',
  bun: '1.2.0',
}

export const resolvePackageManager = (name: string | undefined): PackageManager =>
  isPackageManagerName(name) ? PACKAGE_MANAGER_COMMANDS[name] : PACKAGE_MANAGER_COMMANDS.npm

export function resolveExplicitPackageManager(name: unknown): PackageManager {
  if (!isPackageManagerName(name)) {
    throw new Error(
      `Invalid package manager: ${String(name)} (expected ${PACKAGE_MANAGERS.join(', ')})`,
    )
  }
  return PACKAGE_MANAGER_COMMANDS[name]
}

export function detectPackageManager(): PackageManager {
  const name = (process.env.npm_config_user_agent ?? '').split('/')[0] ?? ''
  return resolvePackageManager(name)
}

const LOCKFILES: Record<PackageManagerName, readonly string[]> = {
  pnpm: ['pnpm-lock.yaml'],
  npm: ['package-lock.json'],
  yarn: ['yarn.lock'],
  bun: ['bun.lock', 'bun.lockb'],
}

const SHADCN_LOCKFILES: readonly (readonly [string, PackageManagerName])[] = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['pnpm-workspace.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
]

function packageManagerField(pkg: JsonObject): string | null {
  if (typeof pkg.packageManager === 'string') return pkg.packageManager
  const devEngines = pkg.devEngines
  const declared = isJsonObject(devEngines) ? devEngines.packageManager : undefined
  if (isJsonObject(declared) && typeof declared.name === 'string') {
    const version = declared.version
    return version ? `${declared.name}@${String(version)}` : declared.name
  }
  return null
}

function packageManagerName(value: string): PackageManagerName | null {
  const name = value.replace(/^\^/, '').split('@')[0]
  return isPackageManagerName(name) ? name : null
}

function detectEffectivePackageManagerAt(current: string): EffectivePackageManager | null {
  for (const [filename, name] of SHADCN_LOCKFILES) {
    const path = join(current, filename)
    if (exists(path)) return { name, pm: resolvePackageManager(name), source: path }
  }

  const packagePath = join(current, 'package.json')
  if (!exists(packagePath)) return null

  let pkg: unknown
  try {
    pkg = readJSON(packagePath)
  } catch {
    return null
  }
  if (!isJsonObject(pkg)) return null
  const raw = packageManagerField(pkg)
  if (raw === null) return null
  const name = packageManagerName(raw)
  return name ? { name, pm: resolvePackageManager(name), source: packagePath, raw } : null
}

export function detectEffectivePackageManager(projectDir: string): EffectivePackageManager | null {
  for (let current = resolve(projectDir); ; current = dirname(current)) {
    const detected = detectEffectivePackageManagerAt(current)
    if (detected) return detected
    if (dirname(current) === current) return null
  }
}

export function detectProjectPackageManager(
  projectRoot: string,
  fallback: PackageManager = detectPackageManager(),
): PackageManager {
  const matches = PACKAGE_MANAGERS.filter((name) =>
    LOCKFILES[name].some((lockfile) => exists(`${projectRoot}/${lockfile}`)),
  )
  if (matches.length > 1) {
    throw new Error(`Ambiguous project package manager: found lockfiles for ${matches.join(', ')}`)
  }
  const [match] = matches
  return match !== undefined
    ? resolvePackageManager(match)
    : (detectEffectivePackageManager(projectRoot)?.pm ?? fallback)
}

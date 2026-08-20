import { dirname, join, resolve } from 'node:path'
import { exists, readJSON } from './util.mjs'

const PACKAGE_MANAGERS = {
  pnpm: {
    name: 'pnpm',
    exec: 'pnpm',
    installArgs: ['install', '--no-frozen-lockfile'],
    runArgs: (script) => ['--config.verify-deps-before-run=false', 'run', script],
    devCmd: 'pnpm dev',
  },
  npm: {
    name: 'npm',
    exec: 'npm',
    installArgs: ['install'],
    runArgs: (script) => ['run', script],
    devCmd: 'npm run dev',
  },
  yarn: {
    name: 'yarn',
    exec: 'yarn',
    installArgs: ['install'],
    runArgs: (script) => ['run', script],
    devCmd: 'yarn dev',
  },
  bun: {
    name: 'bun',
    exec: 'bun',
    installArgs: ['install'],
    runArgs: (script) => ['run', script],
    devCmd: 'bun dev',
  },
}

export const PM_NAMES = ['pnpm', 'npm', 'yarn', 'bun']

export const resolvePackageManager = (name) => PACKAGE_MANAGERS[name] ?? PACKAGE_MANAGERS.npm

export function resolveExplicitPackageManager(name) {
  if (typeof name !== 'string' || !PACKAGE_MANAGERS[name]) {
    throw new Error(`Invalid package manager: ${String(name)} (expected ${PM_NAMES.join(', ')})`)
  }
  return PACKAGE_MANAGERS[name]
}

export function detectPackageManager() {
  const name = (process.env.npm_config_user_agent ?? '').split('/')[0]
  return resolvePackageManager(name)
}

const LOCKFILES = {
  pnpm: ['pnpm-lock.yaml'],
  npm: ['package-lock.json'],
  yarn: ['yarn.lock'],
  bun: ['bun.lock', 'bun.lockb'],
}

const SHADCN_LOCKFILES = [
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['pnpm-lock.yaml', 'pnpm'],
  ['pnpm-workspace.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['npm-shrinkwrap.json', 'npm'],
]

function packageManagerField(pkg) {
  if (typeof pkg.packageManager === 'string') return pkg.packageManager
  if (typeof pkg.devEngines?.packageManager?.name === 'string') {
    const version = pkg.devEngines.packageManager.version
    return version
      ? `${pkg.devEngines.packageManager.name}@${version}`
      : pkg.devEngines.packageManager.name
  }
  return null
}

function packageManagerName(value) {
  if (typeof value !== 'string') return null
  const name = value.replace(/^\^/, '').split('@')[0]
  return PM_NAMES.includes(name) ? name : null
}

function detectEffectivePackageManagerAt(current) {
  for (const [filename, name] of SHADCN_LOCKFILES) {
    const path = join(current, filename)
    if (exists(path)) return { name, pm: resolvePackageManager(name), source: path }
  }

  const packagePath = join(current, 'package.json')
  if (!exists(packagePath)) return null

  let pkg
  try {
    pkg = readJSON(packagePath)
  } catch {
    return null
  }
  const raw = packageManagerField(pkg)
  const name = packageManagerName(raw)
  return name ? { name, pm: resolvePackageManager(name), source: packagePath, raw } : null
}

export function detectEffectivePackageManager(projectDir) {
  for (let current = resolve(projectDir); ; current = dirname(current)) {
    const detected = detectEffectivePackageManagerAt(current)
    if (detected) return detected
    if (dirname(current) === current) return null
  }
}

export function detectProjectPackageManager(projectRoot, fallback = detectPackageManager()) {
  const matches = Object.entries(LOCKFILES)
    .filter(([, lockfiles]) => lockfiles.some((lockfile) => exists(`${projectRoot}/${lockfile}`)))
    .map(([name]) => name)
  if (matches.length > 1) {
    throw new Error(`Ambiguous project package manager: found lockfiles for ${matches.join(', ')}`)
  }
  return matches.length === 1
    ? resolvePackageManager(matches[0])
    : (detectEffectivePackageManager(projectRoot)?.pm ?? fallback)
}

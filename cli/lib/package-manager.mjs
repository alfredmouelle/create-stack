import { exists } from './util.mjs'

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

export function detectProjectPackageManager(projectRoot, fallback = detectPackageManager()) {
  const matches = Object.entries(LOCKFILES)
    .filter(([, lockfiles]) => lockfiles.some((lockfile) => exists(`${projectRoot}/${lockfile}`)))
    .map(([name]) => name)
  if (matches.length > 1) {
    throw new Error(`Ambiguous project package manager: found lockfiles for ${matches.join(', ')}`)
  }
  return matches.length === 1 ? resolvePackageManager(matches[0]) : fallback
}

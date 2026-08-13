import { exists } from './util.mjs'

// Detect the package manager that launched the CLI (npx / pnpm dlx / yarn create
// / bun create) and describe how to install + run scripts with it. Every PM sets
// npm_config_user_agent ("pnpm/9.1.0 npm/? node/v22 ..."); we read its first token.
// Defaults to npm — the documented `npx create-stack` entry point.

/** @typedef {{ name: string, exec: string, installArgs: string[], runArgs: (script: string) => string[], devCmd: string }} PackageManager */

// `dev` is shown verbatim in the README + outro. npm has no script shorthand
// (`npm dev` errors), so it needs `run`; pnpm/yarn/bun accept the bare form.
/** @type {Record<string, PackageManager>} */
const PACKAGE_MANAGERS = {
  pnpm: {
    name: 'pnpm',
    exec: 'pnpm',
    installArgs: ['install', '--no-frozen-lockfile'],
    // verify-deps-before-run=false: skip pnpm's lockfile check on the fresh fork.
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

/** Supported package-manager names, in display order. */
export const PM_NAMES = ['pnpm', 'npm', 'yarn', 'bun']

/** Resolve a name to its descriptor, falling back to npm for anything unknown. */
export const resolvePackageManager = (name) => PACKAGE_MANAGERS[name] ?? PACKAGE_MANAGERS.npm

/** Resolve an explicit CLI choice without silently replacing invalid input. */
export function resolveExplicitPackageManager(name) {
  if (typeof name !== 'string' || !PACKAGE_MANAGERS[name]) {
    throw new Error(`Invalid package manager: ${String(name)} (expected ${PM_NAMES.join(', ')})`)
  }
  return PACKAGE_MANAGERS[name]
}

/**
 * Resolve the package manager from npm_config_user_agent.
 * @returns {PackageManager}
 */
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

/** Detect the package manager selected by a lockfile at the project root. */
export function detectProjectPackageManager(projectRoot, fallback = detectPackageManager()) {
  const matches = Object.entries(LOCKFILES)
    .filter(([, lockfiles]) => lockfiles.some((lockfile) => exists(`${projectRoot}/${lockfile}`)))
    .map(([name]) => name)
  if (matches.length > 1) {
    throw new Error(`Ambiguous project package manager: found lockfiles for ${matches.join(', ')}`)
  }
  return matches.length === 1 ? resolvePackageManager(matches[0]) : fallback
}

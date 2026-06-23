// Detect the package manager that launched the CLI (npx / pnpm dlx / yarn create
// / bun create) and describe how to install + run scripts with it. Every PM sets
// npm_config_user_agent ("pnpm/9.1.0 npm/? node/v22 ..."); we read its first token.
// Defaults to npm — the documented `npx create-stack` entry point.

/** @typedef {{ name: string, exec: string, runArgs: (script: string) => string[], devCmd: string }} PackageManager */

// `dev` is shown verbatim in the README + outro. npm has no script shorthand
// (`npm dev` errors), so it needs `run`; pnpm/yarn/bun accept the bare form.
/** @type {Record<string, PackageManager>} */
const PACKAGE_MANAGERS = {
  pnpm: {
    name: 'pnpm',
    exec: 'pnpm',
    // verify-deps-before-run=false: skip pnpm's lockfile check on the fresh fork.
    runArgs: (script) => ['--config.verify-deps-before-run=false', 'run', script],
    devCmd: 'pnpm dev',
  },
  npm: { name: 'npm', exec: 'npm', runArgs: (script) => ['run', script], devCmd: 'npm run dev' },
  yarn: { name: 'yarn', exec: 'yarn', runArgs: (script) => ['run', script], devCmd: 'yarn dev' },
  bun: { name: 'bun', exec: 'bun', runArgs: (script) => ['run', script], devCmd: 'bun dev' },
}

/** Supported package-manager names, in display order. */
export const PM_NAMES = ['pnpm', 'npm', 'yarn', 'bun']

/** Resolve a name to its descriptor, falling back to npm for anything unknown. */
export const resolvePackageManager = (name) => PACKAGE_MANAGERS[name] ?? PACKAGE_MANAGERS.npm

/**
 * Resolve the package manager from npm_config_user_agent.
 * @returns {PackageManager}
 */
export function detectPackageManager() {
  const name = (process.env.npm_config_user_agent ?? '').split('/')[0]
  return resolvePackageManager(name)
}

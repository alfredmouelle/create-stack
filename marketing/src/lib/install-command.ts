export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

const EXECUTORS: Record<PackageManager, string> = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
}

export function installCommand(packageManager: PackageManager) {
  return `${EXECUTORS[packageManager]} @alfredmouelle/create-stack@latest my-app`
}

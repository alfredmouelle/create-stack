import type { PackageManagerName } from '@alfredmouelle/stack-config'

const EXECUTORS: Record<PackageManagerName, string> = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
}

export function installCommand(packageManager: PackageManagerName) {
  return `${EXECUTORS[packageManager]} @alfredmouelle/create-stack@latest my-app`
}

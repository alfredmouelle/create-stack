import type { PackageManagerName } from '@alfredmouelle/stack-config'
import type { CliRelease } from '@alfredmouelle/stack-config/release'
import { CLI_RELEASE } from './cli-release'

const EXECUTORS: Record<PackageManagerName, string> = {
  pnpm: 'pnpm dlx',
  npm: 'npx',
  yarn: 'yarn dlx',
  bun: 'bunx',
}

export function installCommand(
  packageManager: PackageManagerName,
  release: CliRelease = CLI_RELEASE,
): string {
  return `${EXECUTORS[packageManager]} ${release.packageName}@${release.version} my-app`
}

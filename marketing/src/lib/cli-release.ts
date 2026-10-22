import { FRAMEWORK_SUPPORT, FRAMEWORKS, type Framework } from '@alfredmouelle/stack-config'
import { type CliRelease, parseCliRelease } from '@alfredmouelle/stack-config/release'
import snapshot from '../data/cli-release.json' with { type: 'json' }

export const CLI_RELEASE = parseCliRelease(snapshot.manifest)
export const CLI_PACKAGE = `${CLI_RELEASE.packageName}@${CLI_RELEASE.version}`
export const RELEASED_FRAMEWORKS = FRAMEWORKS.filter(
  (id) => CLI_RELEASE.frameworks[id] !== undefined,
)
export const RELEASE_FRAMEWORK_SUPPORT = { ...FRAMEWORK_SUPPORT, ...CLI_RELEASE.frameworks }
export const RELEASE_CAPABILITIES = CLI_RELEASE.capabilities
export const RELEASE_FLAGS = CLI_RELEASE.flags
export const RELEASE_PACKAGE_MANAGERS = CLI_RELEASE.packageManagers
export const RELEASE_MONOREPOS = CLI_RELEASE.monorepoOrchestrators

export function frameworkAvailabilityMessage(
  id: Framework,
  release: CliRelease = CLI_RELEASE,
): string | undefined {
  if (release.frameworks[id] !== undefined) return
  return `${FRAMEWORK_SUPPORT[id].label} is coming in the next release. It is unavailable in CLI ${release.version}.`
}

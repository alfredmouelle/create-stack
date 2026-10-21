export {
  AUTHS,
  DATABASES,
  FRAMEWORK_SUPPORT,
  frameworkTitle,
  MAILERS,
  PACKAGE_MANAGERS,
  QUALITY_TOOL_LABELS,
  RECOMMENDED_FRAMEWORK,
} from '../../packages/stack-config/src/index.ts'
export { validateAdditions, wireCapabilityAddition } from './additions.ts'
export type { CreationConfiguration } from './creation-configuration.ts'
export { resolveCreationConfiguration } from './creation-configuration.ts'
export type { CreationRequest, CreationResult, GateOptions } from './engine.ts'
export { createProject, runVerificationGate } from './engine.ts'
export type * from './framework-module.ts'
export {
  detectFrameworkModule,
  frameworkModules,
  getFrameworkModule,
  requireFrameworkModule,
} from './framework-registry.ts'
export {
  ADDABLE,
  adapterChoicesFor,
  addableChoices,
  addCapability,
  currentTargetAdapter,
  resolveAdditionKind,
  resolveTargetAdapter,
  targetDir,
} from './javascript/add-command.ts'
export { detectAlias, rewriteAlias } from './javascript/import-alias.ts'
export { isValidAlias, normalizeAlias, parseArgs, resolveMonorepo } from './lib/args.ts'
export { resolveAuth } from './lib/auth.ts'
export {
  CAPABILITIES,
  canonicalCapabilityName,
  capabilityChoices,
  creationProviderChoices,
  resolveCreationProvider,
} from './lib/capabilities.ts'
export { resolveDatabase } from './lib/database.ts'
export {
  detectPackageManager,
  detectProjectPackageManager,
  resolveExplicitPackageManager,
  resolvePackageManager,
} from './lib/package-manager.ts'
export {
  findCompatibleApplications,
  relativeApplicationPath,
  resolveApplicationPath,
} from './lib/project-target.ts'
export { COMPONENT_CATALOG, COMPONENT_NAMES } from './lib/registry.ts'
export { installRegistryComponents, preflightRegistryComponents } from './lib/shadcn.ts'
export { CLI_VERSION } from './lib/version.ts'
export type { QualityProfileException, QualityProfileOption } from './quality-profile.ts'

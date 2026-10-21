export { validateAdditions, wireCapabilityAddition } from './additions.ts'
export type { CreationRequest, CreationResult, GateOptions } from './engine.ts'
export { createProject, runVerificationGate } from './engine.ts'
export type * from './framework-module.ts'
export {
  detectFrameworkModule,
  frameworkModules,
  getFrameworkModule,
} from './framework-registry.ts'
export { detectAlias, rewriteAlias } from './javascript/import-alias.ts'
export type { QualityProfileException, QualityProfileOption } from './quality-profile.ts'

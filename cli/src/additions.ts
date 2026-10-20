import { FRAMEWORK_SUPPORT } from '../../packages/stack-config/src/index.ts'
import type {
  AdditionSelection,
  CapabilityAddition,
  CapabilityAdditionRequest,
  CapabilityAdditionResult,
  FrameworkModule,
} from './framework-module.ts'

function requireCapability(
  module: FrameworkModule,
  cap: string,
  adapter: string | null,
): CapabilityAddition {
  const capability = module.additions.capabilities[cap]
  if (!capability?.providers.includes(adapter)) {
    throw new Error(
      `${FRAMEWORK_SUPPORT[module.id].label} does not support addition ${cap}${adapter ? ` (${adapter})` : ''}`,
    )
  }
  return capability
}

export function validateAdditions(
  module: FrameworkModule,
  selections: readonly AdditionSelection[],
): void {
  for (const selection of selections) {
    if (selection.type === 'capability') {
      requireCapability(module, selection.cap, selection.adapter)
    } else if (module.additions.componentRoot === null) {
      throw new Error(`${FRAMEWORK_SUPPORT[module.id].label} does not support component additions`)
    }
  }
}

export function wireCapabilityAddition(
  module: FrameworkModule,
  request: CapabilityAdditionRequest & { readonly cap: string },
): CapabilityAdditionResult {
  return requireCapability(module, request.cap, request.adapter).apply(request)
}

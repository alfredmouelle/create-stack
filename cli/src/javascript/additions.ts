import {
  adapterChoices,
  adapterRemovableDeps,
  CAPABILITIES,
  currentAdapter,
  hasAdapters,
  installedAdapters,
  vendorCapability,
  vendorPackageSrc,
} from '#lib/capabilities.ts'
import { join } from '#lib/util.ts'
import type { AdditionWiring, CapabilityAddition, ModuleIntegration } from '../framework-module.ts'
import { currentMailerAdapter, MAILER_ADAPTERS, vendorMailer } from './mailer.ts'

const emptyResult = {
  addDeps: {},
  removeDeps: [],
  envKeys: [],
  requiredEnvKeys: [],
  swappedFrom: null,
  manualSteps: [],
}

function portAddition(cap: string): CapabilityAddition {
  const choices = adapterChoices(cap)
  if (!choices) throw new Error(`No providers declared for ${cap}`)
  return {
    providers: choices.options.map(({ value }) => value),
    apply: (request) => {
      const from = currentAdapter(request.projectDir, cap)
      const removeDeps = request.keep
        ? []
        : adapterRemovableDeps(cap, installedAdapters(request.projectDir, cap), request.adapter)
      return {
        ...vendorCapability({ ...request, cap, integration: undefined }),
        removeDeps,
        swappedFrom: from && from !== request.adapter ? from : null,
        manualSteps: [],
      }
    },
  }
}

export function javascriptAdditions({
  componentRoot,
  mailerSource,
  modules,
}: {
  readonly componentRoot: string
  readonly mailerSource: string
  readonly modules: Readonly<Record<string, ModuleIntegration>>
}): AdditionWiring {
  const capabilities: Record<string, CapabilityAddition> = Object.fromEntries(
    CAPABILITIES.filter(hasAdapters).map((cap) => [cap, portAddition(cap)]),
  )
  capabilities.mailer = {
    providers: MAILER_ADAPTERS,
    apply: ({ projectDir, adapter, keep }) => {
      const from = currentMailerAdapter(projectDir)
      return {
        ...vendorMailer(projectDir, mailerSource, adapter, keep),
        swappedFrom: from && from !== adapter ? from : null,
        manualSteps: [],
      }
    },
  }
  for (const [cap, directory] of Object.entries({
    'email-ui': 'src/emails/components',
    http: 'src/lib/http',
  })) {
    capabilities[cap] = {
      providers: [null],
      apply: ({ projectDir }) => {
        vendorPackageSrc(cap, join(projectDir, directory))
        return emptyResult
      },
    }
  }
  for (const [cap, integration] of Object.entries(modules)) {
    capabilities[cap] = {
      providers: [integration.provider, null],
      apply: (request) => ({
        ...vendorCapability({ ...request, cap, integration }),
        removeDeps: [],
        swappedFrom: null,
        manualSteps: integration.manualSteps ?? [],
      }),
    }
  }
  return { componentRoot, capabilities }
}

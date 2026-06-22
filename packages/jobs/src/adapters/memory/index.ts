import type { JobDefinition, JobEvent, JobsPort } from '../../core/port.js'

export interface MemoryJobsAdapter extends JobsPort {
  /** Jobs registered so far, keyed by the event name they subscribe to. */
  readonly jobs: ReadonlyMap<string, JobDefinition[]>
}

/**
 * Synchronous, in-process jobs adapter for dev and tests. `trigger` runs every
 * matching handler inline (awaiting async ones) — no queue, no network. Lets
 * job logic be unit-tested without Inngest.
 */
export function memoryAdapter(): MemoryJobsAdapter {
  const jobs = new Map<string, JobDefinition[]>()

  return {
    name: 'memory',
    jobs,
    defineJob<T>(def: JobDefinition<T>): JobDefinition<T> {
      const existing = jobs.get(def.event) ?? []
      existing.push(def as JobDefinition)
      jobs.set(def.event, existing)
      return def
    },
    async trigger<T>(event: JobEvent<T>): Promise<void> {
      const handlers = jobs.get(event.name) ?? []
      for (const def of handlers) {
        await def.handler(event)
      }
    },
  }
}

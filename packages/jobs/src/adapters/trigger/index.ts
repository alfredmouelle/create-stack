import { configure, task, tasks } from '@trigger.dev/sdk'
import * as v from 'valibot'
import type { JobDefinition, JobEvent, JobsPort } from '../../core/port.js'
import { JobsError } from '../../core/port.js'
import { TriggerDevConfigSchema } from './config.js'

/** A Trigger.dev task object as returned by `task()`. Opaque to us. */
export type TriggerTask = unknown

/**
 * Minimal structural view of the Trigger.dev SDK we depend on. The real
 * `task`/`tasks.trigger` satisfy this; tests pass a mock with the same shape so
 * nothing ever hits the network.
 */
export interface TriggerDevLike {
  task(config: { id: string; run: (payload: unknown) => Promise<void> | void }): TriggerTask
  trigger(id: string, payload: unknown): Promise<unknown>
}

export interface TriggerDevAdapterOptions {
  /** Secret key used to authenticate triggers. Defaults to `TRIGGER_SECRET_KEY`. */
  secretKey?: string
  /** Inject a custom/mock SDK. Defaults to the real `@trigger.dev/sdk`. */
  client?: TriggerDevLike
}

export interface TriggerDevJobsAdapter extends JobsPort {
  /** Tasks created via `defineJob`, to re-export from your Trigger.dev `dirs`. */
  readonly tasks: TriggerTask[]
}

/**
 * Bridge the real SDK to our structural {@link TriggerDevLike}. `task` and
 * `tasks.trigger` have richer signatures than we model, so they're narrowed here.
 */
function defaultClient(secretKey?: string): TriggerDevLike {
  if (secretKey) configure({ secretKey })
  return {
    task: task as unknown as TriggerDevLike['task'],
    trigger: (id, payload) =>
      (tasks.trigger as (id: string, payload: unknown) => Promise<unknown>)(id, payload),
  }
}

/**
 * Trigger.dev jobs adapter. Each {@link JobDefinition} becomes a Trigger.dev
 * task; `trigger` routes an event to every task subscribed to its `name`.
 *
 * Trigger.dev has no event bus — tasks are triggered by id — so the adapter
 * keeps an event → task-ids map and fans out on `trigger`. The created tasks are
 * collected on `adapter.tasks` so they can be re-exported from a file under your
 * Trigger.dev `dirs` (that's how the CLI discovers them).
 */
export function triggerDevAdapter(options: TriggerDevAdapterOptions = {}): TriggerDevJobsAdapter {
  const config = v.parse(TriggerDevConfigSchema, { secretKey: options.secretKey })
  const client: TriggerDevLike = options.client ?? defaultClient(config.secretKey)

  const createdTasks: TriggerTask[] = []
  // event name -> ids of the tasks subscribed to it
  const routes = new Map<string, string[]>()

  return {
    name: 'trigger.dev',
    tasks: createdTasks,
    defineJob<T>(def: JobDefinition<T>): JobDefinition<T> {
      const created = client.task({
        id: def.id,
        run: (payload) => def.handler({ name: def.event, data: payload } as JobEvent<T>),
      })
      createdTasks.push(created)
      const ids = routes.get(def.event) ?? []
      ids.push(def.id)
      routes.set(def.event, ids)
      return def
    },
    async trigger<T>(event: JobEvent<T>): Promise<void> {
      const ids = routes.get(event.name) ?? []
      try {
        await Promise.all(ids.map((id) => client.trigger(id, event.data)))
      } catch (cause) {
        throw new JobsError('Failed to trigger Trigger.dev task', {
          adapter: 'trigger.dev',
          cause,
        })
      }
    },
  }
}

/** Collect the Trigger.dev tasks to re-export from a file under your `dirs`. */
export function triggerDevTasks(adapter: TriggerDevJobsAdapter): TriggerTask[] {
  return adapter.tasks
}

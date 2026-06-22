import { describe, expect, it, type Mock, vi } from 'vitest'
import { type TriggerDevLike, triggerDevAdapter } from '../src/adapters/trigger/index.js'

function mockClient() {
  const fakeTask = { id: 'fake-task' }
  const task: Mock<TriggerDevLike['task']> = vi.fn(() => fakeTask)
  const trigger: Mock<TriggerDevLike['trigger']> = vi.fn(async () => ({ id: 'run_1' }))
  const client: TriggerDevLike = { task, trigger }
  return { client, task, trigger, fakeTask }
}

describe('triggerDevAdapter', () => {
  it('registers a task via task() and collects it', () => {
    const { client, task, fakeTask } = mockClient()
    const adapter = triggerDevAdapter({ client })

    adapter.defineJob({ id: 'job-1', event: 'user/created', handler: vi.fn() })

    expect(task).toHaveBeenCalledTimes(1)
    expect(task).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'job-1', run: expect.any(Function) }),
    )
    expect(adapter.tasks).toEqual([fakeTask])
  })

  it('the registered task invokes the job handler with the event', () => {
    const { client, task } = mockClient()
    const adapter = triggerDevAdapter({ client })
    const handler = vi.fn()
    adapter.defineJob({ id: 'job-1', event: 'user/created', handler })

    const run = task.mock.calls[0]?.[0].run
    run?.({ id: 9 })

    expect(handler).toHaveBeenCalledWith({ name: 'user/created', data: { id: 9 } })
  })

  it('routes trigger() to every task subscribed to the event name', async () => {
    const { client, trigger } = mockClient()
    const adapter = triggerDevAdapter({ client })
    adapter.defineJob({ id: 'job-a', event: 'user/created', handler: vi.fn() })
    adapter.defineJob({ id: 'job-b', event: 'user/created', handler: vi.fn() })
    adapter.defineJob({ id: 'job-c', event: 'user/deleted', handler: vi.fn() })

    await adapter.trigger({ name: 'user/created', data: { id: 1 } })

    expect(trigger).toHaveBeenCalledTimes(2)
    expect(trigger).toHaveBeenCalledWith('job-a', { id: 1 })
    expect(trigger).toHaveBeenCalledWith('job-b', { id: 1 })
  })

  it('does nothing when no task is subscribed to the event', async () => {
    const { client, trigger } = mockClient()
    const adapter = triggerDevAdapter({ client })

    await adapter.trigger({ name: 'nobody/listens', data: {} })

    expect(trigger).not.toHaveBeenCalled()
  })

  it('wraps a trigger failure into a JobsError', async () => {
    const trigger = vi.fn(async () => {
      throw new Error('network down')
    })
    const adapter = triggerDevAdapter({ client: { task: vi.fn(() => ({})), trigger } })
    adapter.defineJob({ id: 'job-1', event: 'x', handler: vi.fn() })

    await expect(adapter.trigger({ name: 'x', data: {} })).rejects.toMatchObject({
      name: 'JobsError',
      adapter: 'trigger.dev',
    })
  })
})

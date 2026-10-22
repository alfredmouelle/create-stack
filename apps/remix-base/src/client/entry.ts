import { run } from 'remix/component'
import { captureClientError } from './observability.ts'

function moduleObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

const app = run({
  async loadModule(moduleUrl, exportName) {
    const module: unknown = await import(moduleUrl)
    if (!moduleObject(module)) throw new Error('Invalid application module')
    const component = module[exportName]
    if (typeof component !== 'function') throw new Error('Unknown application component')
    return component
  },
})

app.addEventListener('error', (event) => {
  captureClientError(event.error)
})
window.addEventListener('error', (event) => {
  captureClientError(event.error)
})
window.addEventListener('unhandledrejection', (event) => {
  captureClientError(event.reason)
})
await app.ready()

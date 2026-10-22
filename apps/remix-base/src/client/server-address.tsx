import type { Handle } from 'remix/component'
import { clientEntry } from 'remix/component'

export const ServerAddress = clientEntry(import.meta.url, function ServerAddress(handle: Handle) {
  let address = 'localhost:3000'
  handle.queueTask(() => {
    address = window.location.host
    void handle.update()
  })
  return () => <span>{address}</span>
})

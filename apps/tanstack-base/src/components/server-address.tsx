import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

export function ServerAddress() {
  const host = useSyncExternalStore(
    subscribe,
    () => window.location.host,
    () => null,
  )
  return <code className="text-[#8a8f8b]">{host ?? 'this address'}</code>
}

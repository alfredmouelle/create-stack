import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { localAdapter } from '../src/adapters/local/index.js'

describe('localAdapter', () => {
  let baseDir: string

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'stack-storage-'))
  })

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true })
  })

  it('round-trips bytes through put/get (incl. nested keys)', async () => {
    const storage = localAdapter({ baseDir })
    const data = new TextEncoder().encode('hello')

    await storage.put('nested/dir/file.txt', data)
    const out = await storage.get('nested/dir/file.txt')

    expect(out).not.toBeNull()
    expect(new TextDecoder().decode(out as Uint8Array)).toBe('hello')
  })

  it('round-trips string content', async () => {
    const storage = localAdapter({ baseDir })

    await storage.put('a.txt', 'plain text')
    const out = await storage.get('a.txt')

    expect(new TextDecoder().decode(out as Uint8Array)).toBe('plain text')
  })

  it('get returns null for a missing key', async () => {
    const storage = localAdapter({ baseDir })
    expect(await storage.get('nope.txt')).toBeNull()
  })

  it('exists reflects presence', async () => {
    const storage = localAdapter({ baseDir })

    expect(await storage.exists('x.txt')).toBe(false)
    await storage.put('x.txt', 'x')
    expect(await storage.exists('x.txt')).toBe(true)
  })

  it('delete removes a key and is a no-op when missing', async () => {
    const storage = localAdapter({ baseDir })

    await storage.put('y.txt', 'y')
    await storage.delete('y.txt')
    expect(await storage.exists('y.txt')).toBe(false)

    await expect(storage.delete('y.txt')).resolves.toBeUndefined()
  })

  it('getSignedUrl returns the public url (no real signing)', async () => {
    const storage = localAdapter({ baseDir, publicBaseUrl: 'https://cdn.test/files' })

    const url = await storage.getSignedUrl('avatars/a.png', { operation: 'get' })
    expect(url).toBe('https://cdn.test/files/avatars/a.png')
  })
})

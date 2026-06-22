import { describe, expect, it, vi } from 'vitest'
import { type GcsFileLike, type GcsStorageLike, gcsAdapter } from '../src/adapters/gcs/index.js'

function makeClient(file: Partial<GcsFileLike>) {
  const fileHandle = file as GcsFileLike
  const fileFn = vi.fn(() => fileHandle)
  const bucketFn = vi.fn(() => ({ file: fileFn }))
  const client: GcsStorageLike = { bucket: bucketFn }
  return { client, bucketFn, fileFn, fileHandle }
}

describe('gcsAdapter', () => {
  it('throws at construction when the bucket is missing', () => {
    expect(() => gcsAdapter({ bucket: '', client: { bucket: vi.fn() } })).toThrow()
  })

  it('put saves the file with contentType', async () => {
    const save = vi.fn(async () => {})
    const { client, fileFn } = makeClient({ save })
    const adapter = gcsAdapter({ bucket: 'my-bucket', client })
    const data = new TextEncoder().encode('hi')

    await adapter.put('a/b.txt', data, { contentType: 'text/plain' })

    expect(fileFn).toHaveBeenCalledWith('a/b.txt')
    expect(save).toHaveBeenCalledWith(Buffer.from(data), { contentType: 'text/plain' })
  })

  it('get downloads and maps to Uint8Array', async () => {
    const download = vi.fn(async () => [Buffer.from('hello')] as [Buffer])
    const { client } = makeClient({ download })
    const adapter = gcsAdapter({ bucket: 'my-bucket', client })

    const out = await adapter.get('a.txt')

    expect(new TextDecoder().decode(out as Uint8Array)).toBe('hello')
  })

  it('get returns null when the file is missing (404)', async () => {
    const download = vi.fn(async () => {
      throw Object.assign(new Error('No such object'), { code: 404 })
    })
    const { client } = makeClient({ download })
    const adapter = gcsAdapter({ bucket: 'my-bucket', client })

    expect(await adapter.get('missing.txt')).toBeNull()
  })

  it('delete calls file.delete and ignores 404', async () => {
    const del = vi.fn(async () => ({}))
    const { client, fileFn } = makeClient({ delete: del })
    const adapter = gcsAdapter({ bucket: 'my-bucket', client })

    await adapter.delete('a.txt')
    expect(fileFn).toHaveBeenCalledWith('a.txt')
    expect(del).toHaveBeenCalled()

    const missDel = vi.fn(async () => {
      throw Object.assign(new Error('gone'), { code: 404 })
    })
    const missing = gcsAdapter({
      bucket: 'my-bucket',
      client: makeClient({ delete: missDel }).client,
    })
    await expect(missing.delete('a.txt')).resolves.toBeUndefined()
  })

  it('exists maps the [boolean] tuple', async () => {
    const exists = vi.fn(async () => [true] as [boolean])
    const { client } = makeClient({ exists })
    const adapter = gcsAdapter({ bucket: 'my-bucket', client })

    expect(await adapter.exists('a.txt')).toBe(true)
  })

  it('getSignedUrl maps operation to action and returns the url', async () => {
    const getSignedUrl = vi.fn(async () => ['https://signed.test/url'] as [string])
    const { client } = makeClient({ getSignedUrl })
    const adapter = gcsAdapter({ bucket: 'my-bucket', client })

    const url = await adapter.getSignedUrl('a.txt', { operation: 'put', contentType: 'image/png' })

    expect(url).toBe('https://signed.test/url')
    expect(getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ version: 'v4', action: 'write', contentType: 'image/png' }),
    )
  })
})

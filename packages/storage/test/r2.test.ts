import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { describe, expect, it, type Mock, vi } from 'vitest'
import { r2Endpoint } from '../src/adapters/r2.js'
import { type R2ClientLike, type R2Presigner, r2Adapter, StorageError } from '../src/index.js'

type SendMock = Mock<(command: unknown) => Promise<unknown>>
type PresignMock = Mock<R2Presigner>

function makeAdapter(send: SendMock, presign?: PresignMock) {
  const client: R2ClientLike = { send }
  return r2Adapter({
    bucket: 'my-bucket',
    accountId: 'acc123',
    accessKeyId: 'id',
    secretAccessKey: 'secret',
    client,
    presign: presign ?? (vi.fn(async () => 'https://signed.test/url') as PresignMock),
  })
}

describe('r2Adapter', () => {
  it('reports its name as r2', () => {
    expect(makeAdapter(vi.fn() as SendMock).name).toBe('r2')
  })

  it('throws at construction when account id is missing', () => {
    expect(() => r2Adapter({ bucket: 'b', accountId: '', client: { send: vi.fn() } })).toThrow(
      StorageError,
    )
  })

  it('throws at construction when the bucket is missing', () => {
    expect(() => r2Adapter({ bucket: '', accountId: 'acc123', client: { send: vi.fn() } })).toThrow(
      StorageError,
    )
  })

  it('delegates put to the S3-compatible client', async () => {
    const send: SendMock = vi.fn(async () => ({}))
    const adapter = makeAdapter(send)

    await adapter.put('a/b.txt', new TextEncoder().encode('hi'), { contentType: 'text/plain' })

    const command = send.mock.calls[0]?.[0]
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'a/b.txt',
    })
  })

  it('delegates signed urls to the presigner', async () => {
    const presign: PresignMock = vi.fn(async () => 'https://signed.test/get')
    const adapter = makeAdapter(vi.fn() as SendMock, presign)

    const url = await adapter.getSignedUrl('a.txt', { operation: 'get', expiresInSeconds: 60 })

    expect(url).toBe('https://signed.test/get')
    expect(presign.mock.calls[0]?.[1]).toBeInstanceOf(GetObjectCommand)
  })
})

describe('r2Endpoint', () => {
  it('uses the default host when no jurisdiction is set', () => {
    expect(r2Endpoint('acc123')).toBe('https://acc123.r2.cloudflarestorage.com')
  })

  it('inserts the jurisdiction into the host', () => {
    expect(r2Endpoint('acc123', 'eu')).toBe('https://acc123.eu.r2.cloudflarestorage.com')
    expect(r2Endpoint('acc123', 'fedramp')).toBe('https://acc123.fedramp.r2.cloudflarestorage.com')
  })
})

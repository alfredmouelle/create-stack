import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { describe, expect, it, type Mock, vi } from 'vitest'
import { type S3ClientLike, type S3Presigner, s3Adapter } from '../src/adapters/s3/index.js'

type SendMock = Mock<(command: unknown) => Promise<unknown>>
type PresignMock = Mock<S3Presigner>

function makeAdapter(send: SendMock, presign?: PresignMock) {
  const client: S3ClientLike = { send }
  return s3Adapter({
    bucket: 'my-bucket',
    region: 'eu-west-1',
    client,
    presign: presign ?? (vi.fn(async () => 'https://signed.test/url') as PresignMock),
  })
}

describe('s3Adapter', () => {
  it('throws at construction when the bucket is missing', () => {
    expect(() =>
      s3Adapter({ bucket: '', region: 'eu-west-1', client: { send: vi.fn() } }),
    ).toThrow()
  })

  it('put issues a PutObjectCommand with Bucket/Key/Body/ContentType', async () => {
    const send: SendMock = vi.fn(async () => ({}))
    const adapter = makeAdapter(send)
    const data = new TextEncoder().encode('hi')

    await adapter.put('a/b.txt', data, { contentType: 'text/plain' })

    expect(send).toHaveBeenCalledTimes(1)
    const command = send.mock.calls[0]?.[0]
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'a/b.txt',
      Body: data,
      ContentType: 'text/plain',
    })
  })

  it('get returns the body bytes via transformToByteArray', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const send: SendMock = vi.fn(async () => ({
      Body: { transformToByteArray: async () => bytes },
    }))
    const adapter = makeAdapter(send)

    const out = await adapter.get('a.txt')

    expect(out).toEqual(bytes)
    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(GetObjectCommand)
  })

  it('get returns null when the key does not exist (NoSuchKey)', async () => {
    const send: SendMock = vi.fn(async () => {
      throw Object.assign(new Error('missing'), { name: 'NoSuchKey' })
    })
    const adapter = makeAdapter(send)

    expect(await adapter.get('missing.txt')).toBeNull()
  })

  it('get returns null on a 404 in $metadata', async () => {
    const send: SendMock = vi.fn(async () => {
      throw Object.assign(new Error('missing'), { $metadata: { httpStatusCode: 404 } })
    })
    const adapter = makeAdapter(send)

    expect(await adapter.get('missing.txt')).toBeNull()
  })

  it('delete issues a DeleteObjectCommand', async () => {
    const send: SendMock = vi.fn(async () => ({}))
    const adapter = makeAdapter(send)

    await adapter.delete('a.txt')

    expect(send.mock.calls[0]?.[0]).toBeInstanceOf(DeleteObjectCommand)
  })

  it('exists returns true on success and false on 404 HeadObject', async () => {
    const okSend: SendMock = vi.fn(async () => ({}))
    expect(await makeAdapter(okSend).exists('a.txt')).toBe(true)
    expect(okSend.mock.calls[0]?.[0]).toBeInstanceOf(HeadObjectCommand)

    const missSend: SendMock = vi.fn(async () => {
      throw Object.assign(new Error('not found'), { name: 'NotFound' })
    })
    expect(await makeAdapter(missSend).exists('a.txt')).toBe(false)
  })

  it('getSignedUrl calls presign and returns its value', async () => {
    const presign: PresignMock = vi.fn(async () => 'https://signed.test/get')
    const adapter = makeAdapter(vi.fn() as SendMock, presign)

    const url = await adapter.getSignedUrl('a.txt', { operation: 'get', expiresInSeconds: 60 })

    expect(url).toBe('https://signed.test/get')
    expect(presign).toHaveBeenCalledTimes(1)
    const call = presign.mock.calls[0]
    expect(call?.[1]).toBeInstanceOf(GetObjectCommand)
    expect(call?.[2]).toEqual({ expiresIn: 60 })
  })

  it('getSignedUrl uses a PutObjectCommand for put operations', async () => {
    const presign: PresignMock = vi.fn(async () => 'https://signed.test/put')
    const adapter = makeAdapter(vi.fn() as SendMock, presign)

    await adapter.getSignedUrl('a.txt', { operation: 'put', contentType: 'image/png' })

    const command = presign.mock.calls[0]?.[1]
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect((command as PutObjectCommand).input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'a.txt',
      ContentType: 'image/png',
    })
  })
})

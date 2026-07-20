import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { type PutOptions, type SignedUrlOptions, StorageError, type StoragePort } from '../port.js'

export interface LocalAdapterOptions {
  /** Root directory for stored objects. */
  baseDir: string
  /**
   * Base URL prefixed to keys by {@link StoragePort.getSignedUrl}. NOT signed —
   * returns `${publicBaseUrl}/${key}`. Dev/tests only.
   */
  publicBaseUrl?: string
}

function isNotFound(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  return (error as { code?: string }).code === 'ENOENT'
}

export function localAdapter(options: LocalAdapterOptions): StoragePort {
  // Fail at construction, not on the first call.
  if (!options.baseDir) throw new StorageError('baseDir is required', { adapter: 'local' })

  const resolve = (key: string): string => join(options.baseDir, key)

  return {
    name: 'local',
    async put(key: string, data: Uint8Array | string, _options?: PutOptions) {
      const path = resolve(key)
      try {
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, typeof data === 'string' ? data : Buffer.from(data))
      } catch (cause) {
        throw new StorageError('Local put failed', { adapter: 'local', cause })
      }
    },
    async get(key: string) {
      try {
        const buffer = await readFile(resolve(key))
        return new Uint8Array(buffer)
      } catch (cause) {
        if (isNotFound(cause)) return null
        throw new StorageError('Local get failed', { adapter: 'local', cause })
      }
    },
    async delete(key: string) {
      try {
        await unlink(resolve(key))
      } catch (cause) {
        if (isNotFound(cause)) return
        throw new StorageError('Local delete failed', { adapter: 'local', cause })
      }
    },
    async exists(key: string) {
      try {
        await stat(resolve(key))
        return true
      } catch (cause) {
        if (isNotFound(cause)) return false
        throw new StorageError('Local exists failed', { adapter: 'local', cause })
      }
    },
    async getSignedUrl(key: string, _options: SignedUrlOptions) {
      // No real signing; dev/test only.
      const base = options.publicBaseUrl ?? ''
      return `${base}/${key}`
    },
  }
}

# @alfredmouelle/storage

Object storage through one port. It exposes `put`, `get`, `delete`, `exists`, and
signed URLs. Choose the provider, such as S3, Cloudflare R2, Google Cloud Storage,
or the local filesystem, in the composition root.

## Usage

```ts
import { s3Adapter, type StoragePort } from '@alfredmouelle/storage'

// Choose the provider in the composition root.
export const storage: StoragePort = s3Adapter({
  bucket: process.env.S3_BUCKET!,
  region: process.env.S3_REGION!,
})

// Application code depends only on StoragePort.
await storage.put('avatars/alfred.png', bytes, { contentType: 'image/png' })
const data = await storage.get('avatars/alfred.png') // Uint8Array | null
const url = await storage.getSignedUrl('avatars/alfred.png', { operation: 'get' })
```

## Swapping provider

Change one line in the composition root:

```ts
import { gcsAdapter } from '@alfredmouelle/storage'

export const storage = gcsAdapter({ bucket: process.env.GCS_BUCKET! })
```

```ts
import { r2Adapter } from '@alfredmouelle/storage'

// R2 is S3-compatible. The adapter uses the R2 endpoint and `auto` region.
export const storage = r2Adapter({
  bucket: process.env.R2_BUCKET!,
  accountId: process.env.R2_ACCOUNT_ID!,
  // `eu` or `fedramp`, only for a jurisdiction-restricted bucket: it picks the matching endpoint.
  jurisdiction: process.env.R2_JURISDICTION as 'eu' | undefined,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
})
```

```ts
import { localAdapter } from '@alfredmouelle/storage'

// Development and tests: getSignedUrl returns `${publicBaseUrl}/${key}` without signing.
export const storage = localAdapter({ baseDir: '.storage', publicBaseUrl: '/files' })
```

Call sites stay on `StoragePort`.

## Adding a provider

Implement `StoragePort` in `src/port.ts` with `name`, `put`, `get`, `delete`,
`exists`, and `getSignedUrl`. `get` returns `null` for a missing key, and
`delete` does nothing when the key is missing. Validate required options during
construction so misconfiguration fails fast. Use `src/adapters/s3.ts` or
`src/adapters/local.ts` as references.

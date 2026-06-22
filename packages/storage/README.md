# @stack/storage

Object storage behind a tiny port: `put` / `get` / `delete` / `exists` plus
signed URLs. Application code depends only on the `StoragePort`; the provider
(S3, Cloudflare R2, Google Cloud Storage, local filesystem) is chosen once at
the composition root.

## Usage

```ts
import { s3Adapter, type StoragePort } from '@stack/storage'

// composition root — pick the provider here, once
export const storage: StoragePort = s3Adapter({
  bucket: process.env.S3_BUCKET!,
  region: process.env.S3_REGION!,
})

// anywhere in the app — depends only on the StoragePort
await storage.put('avatars/alfred.png', bytes, { contentType: 'image/png' })
const data = await storage.get('avatars/alfred.png') // Uint8Array | null
const url = await storage.getSignedUrl('avatars/alfred.png', { operation: 'get' })
```

## Swapping provider

Change one line in the composition root:

```ts
import { gcsAdapter } from '@stack/storage'

export const storage = gcsAdapter({ bucket: process.env.GCS_BUCKET! })
```

```ts
import { r2Adapter } from '@stack/storage'

// Cloudflare R2 is S3-compatible — same behavior, R2 endpoint + `auto` region.
export const storage = r2Adapter({
  bucket: process.env.R2_BUCKET!,
  accountId: process.env.R2_ACCOUNT_ID!,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
})
```

```ts
import { localAdapter } from '@stack/storage'

// dev/tests only — getSignedUrl returns `${publicBaseUrl}/${key}`, it does NOT sign.
export const storage = localAdapter({ baseDir: '.storage', publicBaseUrl: '/files' })
```

No call site changes — they all depend on `StoragePort`, never on a provider.

## Adding a provider

Implement `StoragePort` (`src/core/port.ts`): a `name` plus `put` / `get` /
`delete` / `exists` / `getSignedUrl`. `get` returns `null` for a missing key and
`delete` is a no-op on a missing key. Validate config with `valibot` at
construction so misconfiguration fails fast. Look at `src/adapters/s3`
(SDK-based, injectable client + presigner) or `src/adapters/local`
(filesystem) as templates.

import { writeFileSync } from 'node:fs'
import { parseCliRelease } from '@alfredmouelle/stack-config/release'
import snapshot from '../src/data/cli-release.json' with { type: 'json' }
import { fetchPublishedRelease } from './published-release.ts'

const expectedVersion = process.env.EXPECTED_CLI_VERSION?.trim().replace(/^v/, '') || undefined
if (expectedVersion !== undefined && !/^\d+\.\d+\.\d+$/.test(expectedVersion)) {
  throw new Error('EXPECTED_CLI_VERSION must name an exact stable release')
}
const attempts = expectedVersion === undefined ? 1 : 10
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const release = await fetchPublishedRelease({
      snapshot: { integrity: snapshot.integrity, manifest: parseCliRelease(snapshot.manifest) },
      expectedVersion,
    })
    writeFileSync(
      new URL('../src/data/cli-release.json', import.meta.url),
      `${JSON.stringify(release, null, 2)}\n`,
    )
    process.stdout.write(
      `[marketing] verified CLI ${release.manifest.version}: ${Object.keys(release.manifest.frameworks).join(', ')}\n`,
    )
    break
  } catch (error) {
    if (attempt === attempts) throw error
    process.stderr.write(`[marketing] waiting for npm publication (${attempt}/${attempts})\n`)
    await new Promise<void>((resolve) => setTimeout(resolve, 3_000))
  }
}

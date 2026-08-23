import { assertMarketingResponse, rollbackGuidance } from './http-checks.mjs'

const deploymentUrl = process.env.MARKETING_DEPLOYMENT_URL ?? process.argv[2]
const mode = process.env.MARKETING_BUILD_MODE ?? 'validation'

if (!deploymentUrl) {
  console.error(
    'Set MARKETING_DEPLOYMENT_URL or pass the deployed Worker URL as the first argument.',
  )
  console.error(rollbackGuidance())
  process.exit(1)
}

try {
  const result = await assertMarketingResponse(deploymentUrl, {
    expectedIndexable: mode === 'public',
  })
  process.stdout.write(
    `[marketing] deployed Worker smoke passed for ${mode} build (${result.url})\n`,
  )
} catch (error) {
  console.error(
    `[marketing] deployed Worker verification failed: ${error instanceof Error ? error.message : error}`,
  )
  console.error(rollbackGuidance())
  process.exitCode = 1
}

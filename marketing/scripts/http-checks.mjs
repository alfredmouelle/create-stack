const EXPECTED_TITLE = 'Create Stack. A real app wired around your choices'

function normalizeUrl(rawUrl) {
  let url

  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error(`Deployment URL is not a valid URL: ${rawUrl}`)
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Deployment URL must use HTTP or HTTPS: ${rawUrl}`)
  }

  return new URL('/', url)
}

async function readResponse(url, fetchImpl) {
  let response

  try {
    response = await fetchImpl(url)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Could not reach ${url}: ${message}`)
  }

  const body = await response.text()
  return { body, response }
}

function assertSuccessfulResponse(url, response, expectedContentType) {
  if (response.status !== 200) {
    throw new Error(`Worker response at ${url} expected HTTP 200, received ${response.status}`)
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.includes(expectedContentType)) {
    throw new Error(
      `Worker response at ${url} expected ${expectedContentType} content, received ${contentType || 'no content type'}`,
    )
  }
}

export async function assertMarketingResponse(
  rawUrl,
  { expectedIndexable = true, fetchImpl = globalThis.fetch } = {},
) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('The current Node runtime does not provide fetch')
  }

  const homepageUrl = normalizeUrl(rawUrl)
  const homepage = await readResponse(homepageUrl, fetchImpl)
  assertSuccessfulResponse(homepageUrl, homepage.response, 'text/html')

  if (!homepage.body.includes(`<title>${EXPECTED_TITLE}</title>`)) {
    throw new Error(
      `Worker response at ${homepageUrl} did not contain the expected marketing title`,
    )
  }

  const robotsUrl = new URL('robots.txt', homepageUrl)
  const robots = await readResponse(robotsUrl, fetchImpl)
  assertSuccessfulResponse(robotsUrl, robots.response, 'text/plain')

  const allowsCrawling = robots.body.includes('Allow: /')
  const blocksCrawling = robots.body.includes('Disallow: /')
  const includesSitemap = robots.body.includes('Sitemap:')

  if (expectedIndexable && (!allowsCrawling || !includesSitemap || blocksCrawling)) {
    throw new Error(`Worker response at ${robotsUrl} did not expose the public indexing policy`)
  }

  if (!expectedIndexable && (!blocksCrawling || allowsCrawling || includesSitemap)) {
    throw new Error(`Worker response at ${robotsUrl} did not expose the validation noindex policy`)
  }

  return {
    status: homepage.response.status,
    title: EXPECTED_TITLE,
    url: homepageUrl.href,
  }
}

export function rollbackGuidance() {
  return [
    'Manual rollback guidance:',
    '  1. From marketing/, inspect recent versions with:',
    '     pnpm exec wrangler deployments list --config wrangler.jsonc',
    '  2. Roll back the last known-good version with:',
    '     pnpm exec wrangler rollback <VERSION_ID> --config wrangler.jsonc --message "Restore known-good marketing deployment"',
    '  3. Re-run the deployment verification command after the rollback.',
  ].join('\n')
}

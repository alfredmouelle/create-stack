import { describe, expect, it } from 'vitest'
import { assertMarketingResponse } from '../../scripts/http-checks.mjs'

const html =
  '<!doctype html><html><head><title>Create Stack. A real app wired around your choices</title></head></html>'

function response(body: string, status = 200, contentType = 'text/html') {
  return new Response(body, {
    headers: { 'content-type': contentType },
    status,
  })
}

describe('marketing Worker response checks', () => {
  it('accepts the expected public HTML and robots response', async () => {
    const result = await assertMarketingResponse('https://worker.example', {
      fetchImpl: async (input) => {
        const url = String(input)
        if (url.endsWith('/robots.txt')) {
          return response(
            'User-agent: *\nAllow: /\n\nSitemap: https://create-stack.alfredmouelle.com/sitemap.xml\n',
            200,
            'text/plain',
          )
        }
        return response(html)
      },
    })

    expect(result.status).toBe(200)
    expect(result.title).toBe('Create Stack. A real app wired around your choices')
  })

  it('ignores Cloudflare-managed bot blocks when checking the public policy', async () => {
    await expect(
      assertMarketingResponse('https://create-stack.alfredmouelle.com', {
        fetchImpl: async (input) => {
          const url = String(input)
          if (url.endsWith('/robots.txt')) {
            return response(
              [
                'User-agent: *',
                'Content-Signal: search=yes,ai-train=no,use=reference',
                'Allow: /',
                '',
                'User-agent: ClaudeBot',
                'Disallow: /',
                '',
                'User-agent: *',
                'Allow: /',
                'Sitemap: https://create-stack.alfredmouelle.com/sitemap.xml',
                '',
              ].join('\n'),
              200,
              'text/plain',
            )
          }
          return response(html)
        },
      }),
    ).resolves.toMatchObject({ status: 200 })
  })

  it('reports an unexpected Worker response', async () => {
    await expect(
      assertMarketingResponse('https://worker.example', {
        fetchImpl: async () => response('Not found', 404, 'text/plain'),
      }),
    ).rejects.toThrow('expected HTTP 200')
  })
})

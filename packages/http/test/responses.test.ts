import { describe, expect, it } from 'vitest'
import { error, json, noContent, text } from '../src/index.js'

describe('responses', () => {
  it('json sets content-type and serializes body', async () => {
    const res = json({ hello: 'world' }, { status: 201 })
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toEqual({ hello: 'world' })
  })

  it('noContent returns 204 with empty body', async () => {
    const res = noContent()
    expect(res.status).toBe(204)
    expect(await res.text()).toBe('')
  })

  it('text sets text content-type', async () => {
    const res = text('ok')
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await res.text()).toBe('ok')
  })

  it('error wraps message in a json envelope with status', async () => {
    const res = error('nope', 422)
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'nope' })
  })
})

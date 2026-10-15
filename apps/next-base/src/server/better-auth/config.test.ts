import { describe, expect, test } from 'vitest'
import { createAuth } from '~/server/better-auth/config'
import { createInMemoryMailer } from '~/test/fakes'

describe('createAuth', () => {
  test('sends a verification email on sign-up', async () => {
    const { mailer, outbox } = createInMemoryMailer()
    const auth = createAuth({ mailer })

    await auth.api.signUpEmail({
      body: { email: 'grace.hopper@example.com', password: 'compiler-1952', name: 'Grace Hopper' },
    })

    const { internalAdapter } = await auth.$context
    const found = await internalAdapter.findUserByEmail('grace.hopper@example.com')
    expect(found?.user.emailVerified).toBe(false)
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.to).toEqual([{ email: 'grace.hopper@example.com', name: 'Grace Hopper' }])
  })
})

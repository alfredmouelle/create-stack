import { describe, expect, test } from 'vitest'
import { createCallerFactory, createTRPCRouter, protectedProcedure } from '~/server/api/trpc'
import { auth } from '~/server/better-auth'
import { signIn, visitor } from '~/test/app'

const router = createTRPCRouter({
  me: protectedProcedure.query(({ ctx }) => ctx.session.user.email),
})
const createCaller = createCallerFactory(router)

describe('protectedProcedure', () => {
  test('rejects a visitor', async () => {
    await expect(createCaller(visitor()).me()).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  test('accepts a signed-in user', async () => {
    const { context } = await signIn({ email: 'ada.lovelace@example.com' })

    await expect(createCaller(context).me()).resolves.toBe('ada.lovelace@example.com')
  })

  test('starts every test with an empty database', async () => {
    const { internalAdapter } = await auth.$context

    await expect(internalAdapter.listUsers()).resolves.toEqual([])
  })
})

import { TEMPLATES } from './paths.mjs'
import { copy, join, remove } from './util.mjs'

export function applyTesting({ projectDir, sqlDatabase, auth, trpc }) {
  const src = (p) => join(projectDir, 'src', p)
  if (!sqlDatabase) {
    remove(src('test'))
    remove(src('server/api/trpc.test.ts'))
    remove(join(projectDir, '.env.test'))
    copy(join(TEMPLATES, 'testing/vitest.config.mts'), join(projectDir, 'vitest.config.mts'))
    return
  }
  if (auth !== 'better-auth' || !trpc) {
    remove(src('test/app.ts'))
    remove(src('server/api/trpc.test.ts'))
  }
}

import { drizzle } from 'drizzle-orm/node-postgres'

import { env } from '~/env'
import * as schema from '~/server/db/schemas'

export const db = drizzle(env.DATABASE_URL, { schema })

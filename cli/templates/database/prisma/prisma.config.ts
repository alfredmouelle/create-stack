import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'

config({ path: ['.env', '.env.local'], override: true })

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx src/server/db/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})

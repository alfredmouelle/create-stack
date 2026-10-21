import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: ['.env', '.env.local'], override: true })

const url = process.env.DATABASE_URL
if (url === undefined || url === '') {
  throw new Error('DATABASE_URL is not set')
}

export default defineConfig({
  out: './drizzle',
  schema: './src/server/db/schemas/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
})

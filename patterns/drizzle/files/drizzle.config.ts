import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: ['.env.local', '.env'] });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL is not set');
}

export default defineConfig({
  out: './drizzle',
  schema: './src/server/db/schemas/*.schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url },
});

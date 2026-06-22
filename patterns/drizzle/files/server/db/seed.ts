import { config } from 'dotenv';

config({ path: ['.env.local', '.env'] });

// Dynamic import so dotenv populates process.env before the db client reads it.
const { db } = await import('~/server/db');
const { appConfig } = await import('~/server/db/schemas');

async function main() {
  // Seed your tables here (idempotent). Example:
  await db.insert(appConfig).values({}).onConflictDoNothing();

  // biome-ignore lint/suspicious/noConsole: seed reporting
  console.log('✓ Seed terminé');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

import { faker } from '@faker-js/faker'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

// Deterministic across runs.
faker.seed(42)

async function main() {
  // Seed tables here (idempotent), via faker:
  //   const { db } = await import('~/server/db')
  //   await db.insert(user).values({
  //     id: faker.string.uuid(),
  //     name: faker.person.fullName(),
  //     email: faker.internet.email().toLowerCase(),
  //   }).onConflictDoNothing()

  // biome-ignore lint/suspicious/noConsole: seed reporting
  console.log('✓ Seed terminé')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

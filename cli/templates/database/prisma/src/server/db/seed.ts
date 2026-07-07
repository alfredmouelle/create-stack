import { faker } from '@faker-js/faker'
import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

// Deterministic across runs.
faker.seed(42)

async function main() {
  // Seed your tables here (idempotent) via faker + Prisma:
  //   const { db } = await import('~/server/db')
  //   await db.post.create({
  //     data: { title: faker.lorem.sentence() },
  //   })

  // biome-ignore lint/suspicious/noConsole: seed reporting
  console.log('✓ Seed terminé')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

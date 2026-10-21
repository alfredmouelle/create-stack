import { faker } from '@faker-js/faker'
import { config } from 'dotenv'

config({ path: ['.env', '.env.local'], override: true })

// Deterministic across runs.
faker.seed(42)

function main(): void {
  // Seed your tables here (idempotent) via faker + Prisma:
  //   const { db } = await import('~/server/db')
  //   await db.post.create({
  //     data: { title: faker.lorem.sentence() },
  //   })

  // biome-ignore lint/suspicious/noConsole: seed reporting
  console.log('Seed complete')
}

try {
  main()
} catch (error) {
  console.error(error)
  process.exit(1)
}

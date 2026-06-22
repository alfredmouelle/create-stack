import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Single-row application config (the singleton pattern via a constant id).
 * A reusable home for global settings; add columns as the app needs them.
 */
export const APP_CONFIG_ID = 'app_config';

export const appConfig = pgTable('app_config', {
  id: text('id').primaryKey().default(APP_CONFIG_ID),
  notificationEmail: text('notification_email'),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
});

export type AppConfig = typeof appConfig.$inferSelect;
export type AppConfigInsert = typeof appConfig.$inferInsert;

import { sql } from "drizzle-orm";
import { char, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 10 }).notNull().unique(),
    content: text("content").notNull(),
    contentHash: char("content_hash", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("documents_content_hash_live_idx")
      .on(t.contentHash)
      .where(sql`${t.deletedAt} is null`),
  ],
);

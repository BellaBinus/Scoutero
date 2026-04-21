import { pgTable, serial, text, timestamp, integer, varchar, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { searchesTable } from "./searches";
import { companiesTable } from "./companies";

export const jobListingsTable = pgTable("job_listings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id"),
  searchId: integer("search_id").notNull().references(() => searchesTable.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  title: text("title").notNull(),
  location: text("location"),
  url: text("url").notNull(),
  description: text("description"),
  postedAt: text("posted_at"),
  matchedKeywords: text("matched_keywords"),
  status: text("status").notNull().default("new"),
  requireCityMatch: boolean("require_city_match").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertJobListingSchema = createInsertSchema(jobListingsTable).omit({ id: true, createdAt: true });
export type InsertJobListing = z.infer<typeof insertJobListingSchema>;
export type JobListing = typeof jobListingsTable.$inferSelect;

import { pgTable, serial, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { searchesTable } from "./searches";
import { companiesTable } from "./companies";

export const scanLogTable = pgTable("scan_log", {
  id: serial("id").primaryKey(),
  searchId: integer("search_id").notNull().references(() => searchesTable.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  totalJobsFound: integer("total_jobs_found").notNull().default(0),
  matchedJobsFound: integer("matched_jobs_found").notNull().default(0),
  preDedupeCount: integer("pre_dedupe_count").notNull().default(0),
  isAdminScan: boolean("is_admin_scan").notNull().default(false),
  newJobsFound: integer("new_jobs_found"),
  durationMs: integer("duration_ms"),
  atsDetected: text("ats_detected"),
  error: text("error"),
});

export type ScanLog = typeof scanLogTable.$inferSelect;

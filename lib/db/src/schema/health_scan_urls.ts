import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { scanLogTable } from "./scan_log";

export const healthScanUrlsTable = pgTable("health_scan_urls", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id, { onDelete: "cascade" }),
  scanLogId: integer("scan_log_id").notNull().references(() => scanLogTable.id, { onDelete: "cascade" }),
  scannedAt: timestamp("scanned_at").defaultNow().notNull(),
  urlsJson: text("urls_json").notNull(),
});

export type HealthScanUrl = typeof healthScanUrlsTable.$inferSelect;

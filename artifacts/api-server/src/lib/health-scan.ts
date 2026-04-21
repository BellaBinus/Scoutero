import { db, scanLogTable, companiesTable, searchesTable, healthScanUrlsTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { scrapeJobsFromUrl } from "./job-scraper.js";

let running = false;

export function isHealthScanRunning() {
  return running;
}

export async function runHealthScan(): Promise<{ companiesScanned: number; errors: number }> {
  if (running) throw new Error("Health scan already in progress");
  running = true;
  let companiesScanned = 0;
  let errors = 0;
  try {
    const companies = await db.select().from(companiesTable);

    const [search] = await db
      .insert(searchesTable)
      .values({ userId: "__health__", keywords: "[]", status: "running", jobCount: 0 })
      .returning();

    // Pre-load the most recent URL snapshot for every company in one query
    // We only need the latest per company, so fetch all snapshots ordered by scannedAt desc
    // and keep the first per company.
    const allSnapshots = await db
      .select({
        companyId: healthScanUrlsTable.companyId,
        urlsJson: healthScanUrlsTable.urlsJson,
        scannedAt: healthScanUrlsTable.scannedAt,
      })
      .from(healthScanUrlsTable)
      .orderBy(desc(healthScanUrlsTable.scannedAt));

    const latestSnapshotByCompany = new Map<number, Set<string>>();
    for (const row of allSnapshots) {
      if (!latestSnapshotByCompany.has(row.companyId)) {
        try {
          const urls: string[] = JSON.parse(row.urlsJson);
          latestSnapshotByCompany.set(row.companyId, new Set(urls));
        } catch {
          latestSnapshotByCompany.set(row.companyId, new Set());
        }
      }
    }

    for (const company of companies) {
      if (!company.careersUrl) continue;
      const start = Date.now();
      let totalFound = 0;
      let newJobsFound: number | null = null;
      let atsDetected: string | null = null;
      let error: string | null = null;
      let currentUrls: string[] = [];

      try {
        const result = await scrapeJobsFromUrl(company.careersUrl, company.name, [], [], 1);
        totalFound = result.totalFound ?? result.jobs.length;
        atsDetected = result.atsDetected;
        // Prefer allSeenUrls for snapshot tracking (covers ATS types like Workday that return
        // an empty jobs array when no keywords are provided, even though all URLs are collected).
        currentUrls = result.allSeenUrls?.length
          ? result.allSeenUrls
          : result.jobs.map((j) => j.url);

        const prevUrls = latestSnapshotByCompany.get(company.id);
        if (prevUrls !== undefined) {
          newJobsFound = currentUrls.filter((url) => !prevUrls.has(url)).length;
        }
        // If no previous snapshot exists, newJobsFound stays null (first run — no baseline yet)

        companiesScanned++;
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        errors++;
        console.warn(`[health-scan] ${company.name}:`, err);
      }

      const durationMs = Date.now() - start;

      let scanLogId: number | null = null;
      try {
        const [logRow] = await db.insert(scanLogTable).values({
          searchId: search.id,
          companyId: company.id,
          companyName: company.name,
          totalJobsFound: totalFound,
          matchedJobsFound: 0,
          preDedupeCount: 0,
          isAdminScan: true,
          newJobsFound,
          durationMs,
          atsDetected,
          error,
        }).returning({ id: scanLogTable.id });
        scanLogId = logRow.id;
      } catch (e) {
        console.error(`[health-scan] Failed to write scan log for ${company.name}:`, e);
      }

      // Store URL snapshot for future delta computation
      if (scanLogId !== null && currentUrls.length > 0) {
        await db.insert(healthScanUrlsTable).values({
          companyId: company.id,
          scanLogId,
          urlsJson: JSON.stringify(currentUrls),
        }).catch((e) =>
          console.error(`[health-scan] Failed to store URL snapshot for ${company.name}:`, e)
        );
      }
    }

    await db.update(searchesTable)
      .set({ status: "completed" })
      .where(eq(searchesTable.id, search.id));

    console.log(`[health-scan] Done — ${companiesScanned} scanned, ${errors} errors`);
    return { companiesScanned, errors };
  } finally {
    running = false;
  }
}

export function scheduleDaily6am() {
  // Returns today's date string in the server's local timezone (YYYY-MM-DD)
  function todayLocalStr(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Returns the local date string for any Date
  function dateLocalStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // Check DB to see if a scan has already run today, or is currently in progress
  async function hasScannedOrIsRunning(dateStr: string): Promise<boolean> {
    // 1. Check if a scan is currently in-progress (any process) — prevents double-starts
    const windowStart = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2-hour window
    const [runningSearch] = await db
      .select({ id: searchesTable.id })
      .from(searchesTable)
      .where(
        and(
          eq(searchesTable.userId, "__health__"),
          eq(searchesTable.status, "running"),
          gte(searchesTable.createdAt, windowStart)
        )
      )
      .limit(1);
    if (runningSearch) return true;

    // 2. Check if a scan already completed today
    const [last] = await db
      .select({ scannedAt: scanLogTable.scannedAt })
      .from(scanLogTable)
      .orderBy(desc(scanLogTable.scannedAt))
      .limit(1);
    if (!last) return false;
    return dateLocalStr(new Date(last.scannedAt)) === dateStr;
  }

  async function tryRun(reason: string) {
    if (running) return;
    console.log(`[health-scan] Starting scheduled daily run (${reason})`);
    await runHealthScan().catch((err) =>
      console.error("[health-scan] Scheduled run failed:", err)
    );
  }

  // On startup: if it's past 6am today and no scan has run yet, catch up immediately
  setTimeout(async () => {
    const now = new Date();
    if (now.getHours() >= 6) {
      const already = await hasScannedOrIsRunning(todayLocalStr()).catch(() => false);
      if (!already) {
        await tryRun("catch-up after restart");
      } else {
        console.log("[health-scan] Catch-up check: scan already ran today, skipping");
      }
    }
    // Log when next scheduled run is expected
    const next = new Date();
    next.setHours(6, 0, 0, 0);
    if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
    console.log(`[health-scan] Next scheduled window: ${next.toISOString()}`);
  }, 10_000); // wait 10s after startup before catch-up check

  // Poll every minute: fire at 6am if not already scanned today
  setInterval(async () => {
    const now = new Date();
    if (now.getHours() !== 6) return; // only act during the 6am hour
    const already = await hasScannedOrIsRunning(todayLocalStr()).catch(() => false);
    if (!already) {
      await tryRun("scheduled 6am poll");
    }
  }, 60_000);
}

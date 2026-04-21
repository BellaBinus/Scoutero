import { Router, type IRouter } from "express";
import { db, scanLogTable, jobListingsTable } from "@workspace/db";
import { desc, gte, sql, eq, and } from "drizzle-orm";
import { runHealthScan, isHealthScanRunning } from "../lib/health-scan.js";
import { requireAuth, requireAdmin } from "../middlewares/clerkAuth";

const router: IRouter = Router();

router.get("/admin/ops-log", requireAuth, requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(scanLogTable)
      .orderBy(desc(scanLogTable.scannedAt))
      .limit(500);

    const newListingRows = await db
      .select({
        searchId: jobListingsTable.searchId,
        companyId: jobListingsTable.companyId,
        count: sql<number>`cast(count(*) as int)`,
      })
      .from(jobListingsTable)
      .groupBy(jobListingsTable.searchId, jobListingsTable.companyId);

    const newListingMap = new Map<string, number>();
    for (const r of newListingRows) {
      newListingMap.set(`${r.searchId}:${r.companyId}`, r.count);
    }

    const rowsWithNew = rows.map((r) => ({
      ...r,
      newListings: newListingMap.get(`${r.searchId}:${r.companyId}`) ?? 0,
    }));

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentAdminRows = await db
      .select()
      .from(scanLogTable)
      .where(and(
        gte(scanLogTable.scannedAt, sevenDaysAgo),
        eq(scanLogTable.isAdminScan, true),
      ));

    const byCompany = new Map<number, typeof recentAdminRows>();
    for (const row of recentAdminRows) {
      const existing = byCompany.get(row.companyId) ?? [];
      existing.push(row);
      byCompany.set(row.companyId, existing);
    }

    const flaggedCompanyIds = new Set<number>();
    for (const [companyId, companyRows] of byCompany.entries()) {
      if (companyRows.length < 2) continue;
      const allZeroNoError = companyRows.every((r) => r.totalJobsFound === 0 && !r.error);
      if (allZeroNoError) {
        flaggedCompanyIds.add(companyId);
      }
    }

    res.json({
      rows: rowsWithNew,
      flaggedCompanyIds: Array.from(flaggedCompanyIds),
      healthScanRunning: isHealthScanRunning(),
    });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch ops log" });
  }
});

router.post("/admin/health-scan", requireAuth, requireAdmin, async (req, res) => {
  if (isHealthScanRunning()) {
    res.status(409).json({ error: "Health scan already in progress" });
    return;
  }
  runHealthScan().catch((err) =>
    console.error("[health-scan] Manual run failed:", err)
  );
  res.json({ started: true });
});

export default router;

import { Router, type IRouter } from "express";
import { db, searchesTable, companiesTable, jobListingsTable, keywordsTable, usersTable, settingsTable, scanLogTable } from "@workspace/db";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { RunSearchBody, GetSearchParams, ListJobsForSearchParams } from "@workspace/api-zod";
import { scrapeJobsFromUrl } from "../lib/job-scraper.js";
import { matchesLocationFilter, type LocationFilter } from "../lib/location-filter.js";
import { requireAuth } from "../middlewares/clerkAuth";

const router: IRouter = Router();

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const jobs = await db
      .select()
      .from(jobListingsTable)
      .where(eq(jobListingsTable.userId, req.userId))
      .orderBy(desc(jobListingsTable.createdAt));
    res.json(jobs);
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.get("/searches", requireAuth, async (req, res) => {
  try {
    const searches = await db
      .select({
        id: searchesTable.id,
        keywords: searchesTable.keywords,
        status: searchesTable.status,
        jobCount: searchesTable.jobCount,
        createdAt: searchesTable.createdAt,
      })
      .from(searchesTable)
      .where(eq(searchesTable.userId, req.userId))
      .orderBy(searchesTable.createdAt);
    res.json(searches);
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch searches" });
  }
});

router.post("/searches", requireAuth, async (req, res) => {
  const userId = req.userId;
  try {
    const body = RunSearchBody.parse(req.body);
    const keywords = body.keywords;

    const locationFilter: LocationFilter | null = body.location
      ? { ...body.location }
      : null;

    // Load this user's include/exclude keywords and frequency setting from DB
    const [allKeywords, userRows, settingsRows] = await Promise.all([
      db.select().from(keywordsTable).where(eq(keywordsTable.userId, userId)),
      db.select({ minKeywordFrequency: usersTable.minKeywordFrequency }).from(usersTable).where(eq(usersTable.id, userId)),
      db.select({ defaultMinKeywordFrequency: settingsTable.defaultMinKeywordFrequency }).from(settingsTable).where(eq(settingsTable.id, 1)),
    ]);
    const keywordList = allKeywords
      .filter((k) => k.type === "include")
      .map((k) => k.term);
    const excludeTerms = allKeywords
      .filter((k) => k.type === "exclude")
      .map((k) => k.term.toLowerCase());
    const globalDefault = settingsRows[0]?.defaultMinKeywordFrequency ?? 2;
    const effectiveFrequency = userRows[0]?.minKeywordFrequency ?? globalDefault;

    // Create the search record scoped to this user
    const [search] = await db
      .insert(searchesTable)
      .values({ userId, keywords, status: "running", jobCount: 0 })
      .returning();

    // Get companies to search
    let companies = await db.select().from(companiesTable);
    if (body.companyIds && body.companyIds.length > 0) {
      companies = companies.filter((c) => body.companyIds!.includes(c.id));
    }

    const allJobs: {
      userId: string;
      searchId: number;
      companyId: number;
      companyName: string;
      title: string;
      location: string | null;
      url: string;
      description: string | null;
      postedAt: string | null;
      matchedKeywords: string | null;
      requireCityMatch: boolean;
    }[] = [];

    for (const company of companies) {
      if (!company.careersUrl) continue;
      const requireCityMatch = company.requireCityMatch ?? false;
      let totalJobsForCompany = 0;
      let matchedJobsForCompany = 0;
      let atsDetectedForCompany: string | null = null;
      let scanError: string | null = null;
      let durationMsForCompany: number | null = null;
      const scanStart = Date.now();
      try {
        const result = await scrapeJobsFromUrl(company.careersUrl, company.name, keywordList, excludeTerms, effectiveFrequency);
        atsDetectedForCompany = result.atsDetected;
        totalJobsForCompany = result.totalFound ?? result.jobs.length;
        matchedJobsForCompany = result.jobs.length;
        console.log(`[search] ${company.name}: ATS=${result.atsDetected}, found ${result.jobs.length} jobs`);
        let locationSkipped = 0;
        for (const job of result.jobs) {
          if (locationFilter && !matchesLocationFilter(job.location, job.title, locationFilter, requireCityMatch)) {
            locationSkipped++;
            continue;
          }
          allJobs.push({
            userId,
            searchId: search.id,
            companyId: company.id,
            companyName: company.name,
            title: job.title,
            location: job.location,
            url: job.url,
            description: job.description,
            postedAt: job.postedAt,
            matchedKeywords: job.matchedKeywords.length > 0 ? JSON.stringify(job.matchedKeywords) : null,
            requireCityMatch,
          });
        }
        if (locationSkipped > 0) {
          console.log(`[search] ${company.name}: skipped ${locationSkipped} jobs outside location filter`);
        }
        // Stale-job detection (scoped to this user)
        if (result.allSeenUrls && result.allSeenUrls.length > 0) {
          const seenSet = new Set(result.allSeenUrls);
          const existing = await db
            .select({ id: jobListingsTable.id, url: jobListingsTable.url })
            .from(jobListingsTable)
            .where(and(
              eq(jobListingsTable.userId, userId),
              eq(jobListingsTable.companyId, company.id),
              ne(jobListingsTable.status, "removed")
            ));
          const staleIds = existing.filter((j) => !seenSet.has(j.url)).map((j) => j.id);
          if (staleIds.length > 0) {
            await db
              .update(jobListingsTable)
              .set({ status: "removed" })
              .where(inArray(jobListingsTable.id, staleIds));
            console.log(`[search] ${company.name}: marked ${staleIds.length} stale jobs as removed`);
          }
        }
      } catch (err) {
        scanError = err instanceof Error ? err.message : String(err);
        console.warn(`Failed to scrape ${company.name}:`, err);
      } finally {
        durationMsForCompany = Date.now() - scanStart;
        const preDedupeForCompany = allJobs.filter((j) => j.companyId === company.id).length;
        await db.insert(scanLogTable).values({
          searchId: search.id,
          companyId: company.id,
          companyName: company.name,
          totalJobsFound: totalJobsForCompany,
          matchedJobsFound: matchedJobsForCompany,
          preDedupeCount: preDedupeForCompany,
          durationMs: durationMsForCompany,
          atsDetected: atsDetectedForCompany,
          error: scanError,
        }).catch((e) => console.error(`[scan-log] Failed to write log for ${company.name}:`, e));
      }
    }

    // Deduplicate by URL within this user's job listings
    let newJobs = allJobs;
    if (allJobs.length > 0) {
      const existingByUrl = await db
        .select({ url: jobListingsTable.url, status: jobListingsTable.status, title: jobListingsTable.title })
        .from(jobListingsTable)
        .where(and(
          eq(jobListingsTable.userId, userId),
          inArray(jobListingsTable.url, allJobs.map((j) => j.url))
        ));

      const activeUrlSet = new Set(
        existingByUrl.filter((r) => r.status !== "removed").map((r) => r.url)
      );
      const removedByUrl = new Map(
        existingByUrl
          .filter((r) => r.status === "removed")
          .map((r) => [r.url, r.title ?? ""])
      );

      const resurfaced = allJobs.filter((j) => {
        const storedTitle = removedByUrl.get(j.url);
        if (storedTitle === undefined) return false;
        return j.title.trim().toLowerCase() !== storedTitle.trim().toLowerCase();
      });
      if (resurfaced.length > 0) {
        for (const j of resurfaced) {
          await db
            .update(jobListingsTable)
            .set({ status: "new", title: j.title })
            .where(and(eq(jobListingsTable.userId, userId), eq(jobListingsTable.url, j.url)));
        }
        console.log(`[search] Re-surfaced ${resurfaced.length} jobs with changed titles`);
      }

      newJobs = allJobs.filter((j) => !activeUrlSet.has(j.url) && !removedByUrl.has(j.url));
    }

    // Deduplicate by company+title within this user's job listings
    if (newJobs.length > 0) {
      const existingTitles = await db
        .select({ companyName: jobListingsTable.companyName, title: jobListingsTable.title })
        .from(jobListingsTable)
        .where(eq(jobListingsTable.userId, userId));
      const existingTitleSet = new Set(
        existingTitles.map((r) => `${r.companyName}|||${r.title}`)
      );
      newJobs = newJobs.filter(
        (j) => !existingTitleSet.has(`${j.companyName}|||${j.title}`)
      );
    }

    if (newJobs.length > 0) {
      await db.insert(jobListingsTable).values(newJobs);
    }

    // Retroactively mark this user's jobs matching exclude terms as removed
    if (excludeTerms.length > 0) {
      const existing = await db
        .select({ id: jobListingsTable.id, title: jobListingsTable.title })
        .from(jobListingsTable)
        .where(and(
          eq(jobListingsTable.userId, userId),
          ne(jobListingsTable.status, "removed")
        ));
      const toRemove = existing
        .filter((j) => {
          const title = j.title.toLowerCase();
          return excludeTerms.some((term) => title.includes(term));
        })
        .map((j) => j.id);
      if (toRemove.length > 0) {
        await db
          .update(jobListingsTable)
          .set({ status: "removed" })
          .where(inArray(jobListingsTable.id, toRemove));
        console.log(`[search] Retroactively removed ${toRemove.length} jobs matching exclude terms`);
      }
    }

    const jobs = await db
      .select()
      .from(jobListingsTable)
      .where(and(
        eq(jobListingsTable.userId, userId),
        ne(jobListingsTable.status, "removed")
      ))
      .orderBy(desc(jobListingsTable.createdAt));

    const [updatedSearch] = await db
      .update(searchesTable)
      .set({ status: "completed", jobCount: jobs.length })
      .where(eq(searchesTable.id, search.id))
      .returning();

    res.status(201).json({ ...updatedSearch, jobs });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(400).json({ error: "Search failed" });
  }
});

router.get("/searches/:id", requireAuth, async (req, res) => {
  try {
    const { id } = GetSearchParams.parse({ id: Number(req.params.id) });
    const [search] = await db
      .select()
      .from(searchesTable)
      .where(and(eq(searchesTable.id, id), eq(searchesTable.userId, req.userId)));
    if (!search) {
      res.status(404).json({ error: "Search not found" });
      return;
    }
    const jobs = await db
      .select()
      .from(jobListingsTable)
      .where(and(
        eq(jobListingsTable.searchId, id),
        eq(jobListingsTable.userId, req.userId)
      ));
    res.json({ ...search, jobs });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch search" });
  }
});

router.patch("/jobs/batch-status", requireAuth, async (req, res) => {
  try {
    const { ids, status } = req.body as { ids: number[]; status: string };
    const allowed = ["new", "saved", "applied", "removed"];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array" });
      return;
    }
    await db
      .update(jobListingsTable)
      .set({ status })
      .where(and(
        inArray(jobListingsTable.id, ids),
        eq(jobListingsTable.userId, req.userId)
      ));
    res.json({ updated: ids.length });
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to batch update status" });
  }
});

router.patch("/jobs/:id/status", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status: string };
    const allowed = ["new", "saved", "applied", "removed"];
    if (!allowed.includes(status)) {
      res.status(400).json({ error: "Invalid status" });
      return;
    }
    const [updated] = await db
      .update(jobListingsTable)
      .set({ status })
      .where(and(
        eq(jobListingsTable.id, id),
        eq(jobListingsTable.userId, req.userId)
      ))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to update status" });
  }
});

router.get("/searches/:id/jobs", requireAuth, async (req, res) => {
  try {
    const { id } = ListJobsForSearchParams.parse({ id: Number(req.params.id) });
    const jobs = await db
      .select()
      .from(jobListingsTable)
      .where(and(
        eq(jobListingsTable.searchId, id),
        eq(jobListingsTable.userId, req.userId)
      ));
    res.json(jobs);
  } catch (err) {
    console.error(err instanceof Error ? err.stack : String(err));
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

export default router;

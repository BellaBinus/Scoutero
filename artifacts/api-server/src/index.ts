import app from "./app";
import { db, jobListingsTable, companiesTable, healthScanUrlsTable } from "@workspace/db";
import { lt, inArray, desc } from "drizzle-orm";
import { scheduleDaily6am } from "./lib/health-scan.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const SEED_COMPANIES = [
  { name: "Airwallex",      careersUrl: "https://jobs.ashbyhq.com/airwallex",              requireCityMatch: false },
  { name: "BILL",           careersUrl: "https://boards.greenhouse.io/billcom",             requireCityMatch: false },
  { name: "Best Egg",       careersUrl: "https://jobs.lever.co/BestEgg",                   requireCityMatch: false },
  { name: "Block",          careersUrl: "https://boards.greenhouse.io/block",               requireCityMatch: false },
  { name: "Brex",           careersUrl: "https://boards.greenhouse.io/brex",               requireCityMatch: false },
  { name: "Cardless",       careersUrl: "https://jobs.ashbyhq.com/cardless",               requireCityMatch: false },
  { name: "Chime",          careersUrl: "https://boards.greenhouse.io/chime",              requireCityMatch: false },
  { name: "Coinbase",       careersUrl: "https://boards.greenhouse.io/coinbase",           requireCityMatch: false },
  { name: "Dave",           careersUrl: "https://jobs.ashbyhq.com/dave",                   requireCityMatch: false },
  { name: "Earnest",        careersUrl: "https://boards.greenhouse.io/earnest",            requireCityMatch: false },
  { name: "Figure Lending", careersUrl: "https://boards.greenhouse.io/figure",             requireCityMatch: false },
  { name: "Finix",          careersUrl: "https://jobs.lever.co/finix",                     requireCityMatch: false },
  { name: "Gusto",          careersUrl: "https://boards.greenhouse.io/gusto",              requireCityMatch: false },
  { name: "Imprint",        careersUrl: "https://jobs.ashbyhq.com/imprint",               requireCityMatch: false },
  { name: "Kraken",         careersUrl: "https://jobs.ashbyhq.com/kraken.com",             requireCityMatch: false },
  { name: "Lithic",         careersUrl: "https://job-boards.greenhouse.io/lithic",         requireCityMatch: false },
  { name: "Mercury",        careersUrl: "https://boards.greenhouse.io/mercury",            requireCityMatch: false },
  { name: "Monzo",          careersUrl: "https://boards.greenhouse.io/monzo",              requireCityMatch: false },
  { name: "PayPal",         careersUrl: "https://paypal.wd1.myworkdayjobs.com/en-US/jobs", requireCityMatch: false },
  { name: "Plaid",          careersUrl: "https://jobs.lever.co/plaid",                     requireCityMatch: false },
  { name: "Ramp",           careersUrl: "https://jobs.ashbyhq.com/ramp",                   requireCityMatch: false },
  { name: "Ripple",         careersUrl: "https://boards.greenhouse.io/ripple",             requireCityMatch: false },
  { name: "Robinhood",      careersUrl: "https://boards.greenhouse.io/robinhood",          requireCityMatch: false },
  { name: "Sardine",        careersUrl: "https://jobs.ashbyhq.com/sardine",               requireCityMatch: false },
  { name: "SoFi",           careersUrl: "https://boards.greenhouse.io/sofi",              requireCityMatch: true  },
  { name: "Stripe",         careersUrl: "https://stripe.com/jobs",                         requireCityMatch: false },
  { name: "Synctera",       careersUrl: "https://jobs.ashbyhq.com/synctera",              requireCityMatch: false },
  { name: "Tipalti",        careersUrl: "https://boards.greenhouse.io/tipaltisolutions",   requireCityMatch: false },
  { name: "Toast",          careersUrl: "https://boards.greenhouse.io/toast",              requireCityMatch: false },
  { name: "Upgrade",        careersUrl: "https://boards.greenhouse.io/upgrade",            requireCityMatch: false },
];

async function seedCompanies() {
  const seedNames = SEED_COMPANIES.map((c) => c.name);
  const existing = await db
    .select({ name: companiesTable.name })
    .from(companiesTable)
    .where(inArray(companiesTable.name, seedNames));
  const existingNames = new Set(existing.map((r) => r.name));
  const toInsert = SEED_COMPANIES.filter((c) => !existingNames.has(c.name));
  if (toInsert.length === 0) return;
  await db.insert(companiesTable).values(toInsert);
  console.log(`[seed] Inserted ${toInsert.length} new company/companies`);
}

async function cleanupOldJobs() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const deleted = await db
    .delete(jobListingsTable)
    .where(lt(jobListingsTable.createdAt, cutoff))
    .returning({ id: jobListingsTable.id });
  if (deleted.length > 0) {
    console.log(`[cleanup] Deleted ${deleted.length} job(s) older than 30 days`);
  }
}

async function cleanupHealthScanUrls() {
  // Keep only the 2 most recent snapshots per company; delete the rest
  const all = await db
    .select({ id: healthScanUrlsTable.id, companyId: healthScanUrlsTable.companyId })
    .from(healthScanUrlsTable)
    .orderBy(desc(healthScanUrlsTable.scannedAt));

  const countByCompany = new Map<number, number>();
  const toDelete: number[] = [];
  for (const row of all) {
    const count = countByCompany.get(row.companyId) ?? 0;
    if (count >= 2) {
      toDelete.push(row.id);
    } else {
      countByCompany.set(row.companyId, count + 1);
    }
  }
  if (toDelete.length > 0) {
    await db.delete(healthScanUrlsTable).where(inArray(healthScanUrlsTable.id, toDelete));
    console.log(`[cleanup] Deleted ${toDelete.length} old health scan URL snapshot(s)`);
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

seedCompanies().catch((err) => console.error("[seed] Companies seed failed:", err));
cleanupOldJobs().catch((err) => console.error("[cleanup] Initial run failed:", err));
cleanupHealthScanUrls().catch((err) => console.error("[cleanup] Health scan URL cleanup failed:", err));
setInterval(() => {
  cleanupOldJobs().catch((err) => console.error("[cleanup] Scheduled run failed:", err));
  cleanupHealthScanUrls().catch((err) => console.error("[cleanup] Health scan URL cleanup failed:", err));
}, ONE_DAY_MS);

scheduleDaily6am();

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

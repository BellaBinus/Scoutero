import https from "https";
import http from "http";
import { URL } from "url";
import { execFile } from "child_process";

export interface ScrapedJob {
  title: string;
  location: string | null;
  url: string;
  description: string | null;
  postedAt: string | null;
  matchedKeywords: string[];
}

export type AtsType = "greenhouse" | "lever" | "ashby" | "workable" | "bamboohr" | "workday" | "html";

export interface ScrapeResult {
  jobs: ScrapedJob[];
  atsDetected: AtsType;
  /** Total jobs found on the board before keyword filtering. Used for health monitoring. */
  totalFound: number;
  /** All job URLs seen on the board during this scan (Workday only). Used to detect stale listings. */
  allSeenUrls?: string[];
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

function fetchUrl(
  urlStr: string,
  redirectCount = 0,
  timeoutMs = 12000
): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error("Too many redirects"));
    let parsed: URL;
    try {
      parsed = new URL(urlStr);
    } catch {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }
    const lib = parsed.protocol === "https:" ? https : http;
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobScout/1.0; +https://jobscout.app)",
        Accept: "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      timeout: timeoutMs,
    };
    const req = lib.request(options, (res) => {
      if (
        res.statusCode &&
        res.statusCode >= 300 &&
        res.statusCode < 400 &&
        res.headers.location
      ) {
        const redirectUrl = new URL(res.headers.location, urlStr).toString();
        resolve(fetchUrl(redirectUrl, redirectCount + 1, timeoutMs));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () =>
        resolve({
          body: Buffer.concat(chunks).toString("utf8"),
          status: res.statusCode ?? 0,
        })
      );
      res.on("error", reject);
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    req.end();
  });
}

async function tryFetchJson<T>(url: string): Promise<T | null> {
  try {
    const { body, status } = await fetchUrl(url, 0, 30000);
    if (status < 200 || status >= 300) return null;
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

function postJson<T>(urlStr: string, body: unknown, timeoutMs = 15000): Promise<T | null> {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    execFile("curl", [
      "-s", "-X", "POST", urlStr,
      "-H", "Content-Type: application/json",
      "-H", "Accept: application/json",
      "-H", "User-Agent: Mozilla/5.0 (compatible; JobScout/1.0)",
      "-d", bodyStr,
      "--max-time", String(Math.floor(timeoutMs / 1000)),
    ], (err, stdout) => {
      if (err) { resolve(null); return; }
      try { resolve(JSON.parse(stdout) as T); } catch { resolve(null); }
    });
  });
}

// ---------------------------------------------------------------------------
// Boilerplate stripping
// ---------------------------------------------------------------------------

// Phrases that signal the start of boilerplate/disclaimer sections.
// Text from these markers onward is excluded from keyword matching.
const BOILERPLATE_MARKERS = [
  "applicant safety policy",
  "fraud and third-party recruiter",
  "equal opportunity employer",
  "equal employment opportunity",
  "we are an equal opportunity",
  "airwallex will not ask for bank details",
  "diversity, equity and inclusion",
  "reasonable accommodation",
  "we do not discriminate",
  "eeo statement",
  "pay transparency",
  "california privacy",
  "in compliance with the ccpa",
  "notice to applicants",
  "background check",
  "by submitting your application",
  // Fraud disclaimer intros
  "beware of fraud",
  "fraud alert",
  "protect yourself from fraud",
  "warning: fraud",
  "fraud warning",
  "be aware of fraudulent",
  "fraudulent job",
  "fraudulent offer",
  "recruitment fraud",
  "hiring fraud",
  "please be aware, job-seekers",
  "job-seekers may be at risk",
  "malicious actors looking",
  // Compensation / benefits sections (prevents matching keywords like "risk" from "at-risk pay")
  "compensation and benefits",
  "compensation & benefits",
  "compensation range",
  "the base salary range",
  "base pay range",
  "total target compensation",
  "total compensation range",
  "expected base salary",
  "salary range for this",
  "variable compensation",
  "at-risk compensation",
  "at-risk pay",
];

function stripBoilerplate(text: string): string {
  const lower = text.toLowerCase();
  let cutAt = text.length;
  for (const marker of BOILERPLATE_MARKERS) {
    const idx = lower.indexOf(marker);
    if (idx !== -1 && idx < cutAt) cutAt = idx;
  }
  return text.slice(0, cutAt).trim();
}

// ---------------------------------------------------------------------------
// Keyword & exclusion helpers
// ---------------------------------------------------------------------------

function isTitleExcluded(title: string | undefined | null, excludeTerms: string[]): boolean {
  if (!title || excludeTerms.length === 0) return false;
  const lower = title.toLowerCase();
  return excludeTerms.some((term) => lower.includes(term.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Keyword matching
// ---------------------------------------------------------------------------

function keywordRegex(kw: string): RegExp {
  const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Left boundary (\b) prevents matching mid-word (e.g. "AML" inside "streamlining").
  // No right boundary so inflected forms also match: risks, risky, fraudulent, compliant.
  return new RegExp(`\\b${escaped}`, "i");
}

// All keywords require at least 2 occurrences by default to avoid false positives
// (e.g. a single passing mention of "compliance" in a boilerplate section).
// Per-keyword overrides can raise the bar further for especially noisy terms.
const KEYWORD_MIN_COUNT: Record<string, number> = {};

const DEFAULT_KEYWORD_MIN_COUNT = 2;

function countKeyword(text: string, kw: string): number {
  const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "gi");
  return (text.match(re) || []).length;
}

function kwMatches(cleaned: string, kw: string, minCount?: number): boolean {
  const min = minCount ?? KEYWORD_MIN_COUNT[kw.toLowerCase()] ?? DEFAULT_KEYWORD_MIN_COUNT;
  return countKeyword(cleaned, kw) >= min;
}

function matchesKeywords(text: string, keywords: string[], minCount?: number): boolean {
  if (keywords.length === 0) return true;
  const cleaned = stripBoilerplate(text);
  return keywords.some((kw) => kwMatches(cleaned, kw, minCount));
}

function findMatchedKeywords(text: string, keywords: string[], minCount?: number): string[] {
  const cleaned = stripBoilerplate(text);
  return keywords.filter((kw) => kwMatches(cleaned, kw, minCount));
}

// ---------------------------------------------------------------------------
// ATS detection
// ---------------------------------------------------------------------------

function slugFromCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function detectAtsFromUrl(careersUrl: string): {
  ats: AtsType;
  slug: string | null;
} {
  let parsed: URL;
  try {
    parsed = new URL(careersUrl);
  } catch {
    return { ats: "html", slug: null };
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  // Greenhouse: boards.greenhouse.io/slug  or  company.greenhouse.io
  if (host.includes("greenhouse.io")) {
    // boards.greenhouse.io/SLUG or job-boards.greenhouse.io/SLUG
    const match = path.match(/^\/([^/]+)/);
    const slug = match ? match[1] : null;
    return { ats: "greenhouse", slug };
  }

  // Lever: jobs.lever.co/slug
  if (host.includes("lever.co")) {
    const match = path.match(/^\/([^/]+)/);
    const slug = match ? match[1] : null;
    return { ats: "lever", slug };
  }

  // Ashby: jobs.ashbyhq.com/slug
  if (host.includes("ashbyhq.com")) {
    const match = path.match(/^\/([^/]+)/);
    const slug = match ? match[1] : null;
    return { ats: "ashby", slug };
  }

  // Workable: apply.workable.com/company or company.workable.com
  if (host.includes("workable.com")) {
    const match = path.match(/^\/([^/]+)/);
    const slug = match ? match[1] : host.split(".")[0];
    return { ats: "workable", slug };
  }

  // BambooHR: company.bamboohr.com/jobs
  if (host.includes("bamboohr.com")) {
    const slug = host.split(".bamboohr.com")[0];
    return { ats: "bamboohr", slug };
  }

  // Workday: tenant.wd1.myworkdayjobs.com/en-US/BoardName
  if (host.includes("myworkdayjobs.com")) {
    const tenant = host.split(".")[0];
    const boardMatch = path.match(/\/en-US\/([^/?#]+)/);
    const board = boardMatch ? boardMatch[1] : "External";
    return { ats: "workday", slug: `${tenant}|${board}` };
  }

  return { ats: "html", slug: null };
}

async function probeAts(
  companyName: string
): Promise<{ ats: AtsType; slug: string } | null> {
  const slug = slugFromCompanyName(companyName);

  // Try Greenhouse
  const ghData = await tryFetchJson<{ jobs?: unknown[] }>(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`
  );
  if (ghData && Array.isArray(ghData.jobs)) {
    console.log(`[scraper] Detected Greenhouse for ${companyName} (slug: ${slug})`);
    return { ats: "greenhouse", slug };
  }

  // Try Lever
  const leverData = await tryFetchJson<unknown[]>(
    `https://api.lever.co/v0/postings/${slug}?mode=json`
  );
  if (Array.isArray(leverData) && leverData.length >= 0) {
    console.log(`[scraper] Detected Lever for ${companyName} (slug: ${slug})`);
    return { ats: "lever", slug };
  }

  // Try Ashby
  const ashbyData = await tryFetchJson<{ jobPostings?: unknown[] }>(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}`
  );
  if (ashbyData && Array.isArray(ashbyData.jobPostings)) {
    console.log(`[scraper] Detected Ashby for ${companyName} (slug: ${slug})`);
    return { ats: "ashby", slug };
  }

  return null;
}

// ---------------------------------------------------------------------------
// HTML cleaning
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// ATS-specific scrapers
// ---------------------------------------------------------------------------

async function scrapeGreenhouse(
  slug: string,
  keywords: string[],
  excludeTerms: string[] = [],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; allSeenUrls: string[]; totalFound: number }> {
  type GhJob = {
    id: number;
    title: string;
    absolute_url: string;
    location?: { name?: string };
    updated_at?: string;
    content?: string;
  };
  type GhResponse = { jobs: GhJob[] };

  const data = await tryFetchJson<GhResponse>(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
  );
  if (!data || !Array.isArray(data.jobs)) return { jobs: [], allSeenUrls: [], totalFound: 0 };

  const allSeenUrls = data.jobs.map((job) => job.absolute_url).filter(Boolean);
  const totalFound = data.jobs.length;

  const jobs = data.jobs
    .filter((job) => {
      if (isTitleExcluded(job.title, excludeTerms)) return false;
      const desc = job.content ? stripHtml(job.content) : "";
      return matchesKeywords(desc || job.title, keywords, minCount);
    })
    .map((job) => {
      const desc = job.content ? stripHtml(job.content) : "";
      const matchText = desc || job.title;
      return {
        title: job.title,
        location: job.location?.name ?? null,
        url: job.absolute_url,
        description: desc || null,
        postedAt: job.updated_at ?? null,
        matchedKeywords: findMatchedKeywords(matchText, keywords, minCount),
      };
    });

  return { jobs, allSeenUrls, totalFound };
}

async function scrapeLever(
  slug: string,
  keywords: string[],
  excludeTerms: string[] = [],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; allSeenUrls: string[]; totalFound: number }> {
  type LeverJob = {
    id: string;
    text: string;
    hostedUrl: string;
    categories?: { location?: string; allLocations?: string[]; team?: string };
    descriptionPlain?: string;
    additionalPlain?: string;
    lists?: { text: string; content: string }[];
    createdAt?: number;
    workplaceType?: string;
    country?: string;
  };

  const data = await tryFetchJson<LeverJob[]>(
    `https://api.lever.co/v0/postings/${slug}?mode=json`
  );
  if (!Array.isArray(data)) return { jobs: [], allSeenUrls: [], totalFound: 0 };

  const allSeenUrls = data.map((job) => job.hostedUrl).filter(Boolean);
  const totalFound = data.length;

  function leverDescText(job: LeverJob): string {
    const listText = (job.lists ?? [])
      .map((l) => l.text + " " + stripHtml(l.content))
      .join(" ");
    // Strip boilerplate independently per section so that an EEO/legal disclaimer
    // embedded inside descriptionPlain doesn't cut off the lists content
    // (which Lever provides as separate structured sections).
    return [
      job.descriptionPlain ? stripBoilerplate(job.descriptionPlain) : "",
      job.additionalPlain  ? stripBoilerplate(job.additionalPlain)  : "",
      listText             ? stripBoilerplate(listText)             : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  const jobs = data
    .filter((job) => {
      if (isTitleExcluded(job.text, excludeTerms)) return false;
      const desc = leverDescText(job);
      return matchesKeywords(desc || job.text, keywords, minCount);
    })
    .map((job) => {
      const desc = leverDescText(job);
      const matchText = desc || job.text;
      // Normalise location: when Lever explicitly marks a job as remote AND US-based,
      // store "Remote" so the location filter recognises it correctly regardless of
      // how the company has phrased the location string (e.g. "Remote / Flexible").
      // Non-US remote roles (workplaceType=remote but country≠US) keep their original
      // location string so the filter can reject them appropriately.
      // Use allLocations when available (multi-city hybrid roles like "New York / San
      // Francisco") so the location filter can match against any of the listed cities.
      const isUsRemote =
        job.workplaceType === "remote" && job.country?.toUpperCase() === "US";
      const rawLocation =
        job.categories?.allLocations && job.categories.allLocations.length > 0
          ? job.categories.allLocations.join("; ")
          : (job.categories?.location ?? null);
      const location = isUsRemote ? "Remote" : rawLocation;
      return {
        title: job.text,
        location,
        url: job.hostedUrl,
        description: job.descriptionPlain || null,
        postedAt: job.createdAt ? new Date(job.createdAt).toISOString() : null,
        matchedKeywords: findMatchedKeywords(matchText, keywords, minCount),
      };
    });

  return { jobs, allSeenUrls, totalFound };
}

// US-remote patterns used to recognise "Remote (US)" / "Remote (United States)" etc.
const US_REMOTE_RE = /^remote$|remote.*\b(us|usa|u\.s\.a?\.?|united states)\b/i;

/**
 * Normalise an Ashby location string into a single stored value.
 *
 * Ashby can return a semicolon-separated list of locations such as:
 *   "New York, NY (HQ); Remote (Canada); Remote (US); San Francisco, CA"
 *
 * For remote jobs, Ashby uses the `location` and `secondaryLocations` fields to
 * indicate **eligible countries** (not the HQ city). E.g. Kraken lists
 * "United Kingdom; Canada; Portugal" meaning the job is open to residents of
 * those countries only. We must preserve this country information so the
 * location filter can correctly reject non-US jobs.
 *
 * NOTE: Ashby sets isRemote=true for BOTH Remote and Hybrid jobs.
 * The caller must resolve isRem using workplaceType as the authority:
 *   workplaceType==="Remote"          → isRem=true
 *   workplaceType==="Hybrid"          → isRem=false (keep city)
 *   workplaceType===null + isRemote   → isRem=true (legacy fallback)
 *
 * Rules applied to each segment:
 *   - Starts with "Remote" already    → keep as-is (e.g. "Remote (Singapore)")
 *   - isRem + non-remote segment      → "Remote (Segment)" to preserve country
 *   - not isRem                       → keep as-is (in-office or hybrid location)
 *
 * After normalising all segments:
 *   1. Any broadly-US remote segment  → collapse to "Remote"
 *   2. Otherwise return all segments joined with "; "
 */
function normalizeAshbyLocation(
  locStr: string | null | undefined,
  isRem: boolean
): string | null {
  if (!locStr?.trim()) return isRem ? "Remote" : null;

  const segments = locStr.split(";").map((s) => s.trim()).filter(Boolean);

  const normalized = segments.map((seg) => {
    if (seg.toLowerCase().startsWith("remote")) return seg;  // "Remote (Canada)" etc. — keep as-is
    if (isRem) return `Remote (${seg})`;                     // "United Kingdom" → "Remote (United Kingdom)"
    return seg;                                              // In-office location
  });

  // If any segment resolves to a broadly US-remote value, collapse to "Remote"
  if (normalized.some((s) => US_REMOTE_RE.test(s))) return "Remote";

  // Return all segments joined so location filters can check each country
  return normalized.join("; ") || (isRem ? "Remote" : null);
}

async function scrapeAshby(
  slug: string,
  keywords: string[],
  excludeTerms: string[] = [],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; allSeenUrls: string[]; totalFound: number }> {
  type AshbyJob = {
    id: string;
    title: string;
    jobUrl: string;
    isRemote?: boolean;
    workplaceType?: string;
    location?: string;
    secondaryLocations?: { location?: string }[];
    descriptionHtml?: string;
    publishedAt?: string;
  };
  // Ashby returns { jobs: [...] } (not jobPostings)
  type AshbyResponse = { jobs?: AshbyJob[]; jobPostings?: AshbyJob[] };

  const data = await tryFetchJson<AshbyResponse>(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}`
  );
  if (!data) return { jobs: [], allSeenUrls: [], totalFound: 0 };
  const listings = data.jobs ?? data.jobPostings ?? [];
  if (!Array.isArray(listings)) return { jobs: [], allSeenUrls: [], totalFound: 0 };

  const allSeenUrls = listings.map((job) => job.jobUrl).filter(Boolean);
  const totalFound = listings.length;

  const jobs = listings
    .filter((job) => {
      if (isTitleExcluded(job.title, excludeTerms)) return false;
      const desc = job.descriptionHtml ? stripHtml(job.descriptionHtml) : "";
      return matchesKeywords(desc || job.title, keywords, minCount);
    })
    .map((job) => {
      const desc = job.descriptionHtml ? stripHtml(job.descriptionHtml) : "";
      const matchText = desc || job.title;
      // Ashby sets isRemote=true for both Remote AND Hybrid jobs.
      // Use workplaceType as the authority when available.
      const isRem =
        job.workplaceType === "Remote" ||
        (job.workplaceType !== "Hybrid" && job.workplaceType == null && !!job.isRemote);
      // Build a combined location string from primary + all secondary locations
      const allLocationParts = [
        typeof job.location === "string" ? job.location : null,
        ...(job.secondaryLocations ?? []).map((s) => s.location ?? null),
      ].filter((s): s is string => !!s);
      const combinedLocation = allLocationParts.join("; ") || null;
      return {
        title: job.title,
        location: normalizeAshbyLocation(combinedLocation, isRem),
        url: job.jobUrl,
        description: desc || null,
        postedAt: job.publishedAt ?? null,
        matchedKeywords: findMatchedKeywords(matchText, keywords, minCount),
      };
    });

  return { jobs, allSeenUrls, totalFound };
}

async function scrapeWorkable(
  slug: string,
  keywords: string[],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; totalFound: number }> {
  type WorkableJob = {
    id: string;
    title: string;
    shortlink: string;
    location?: { city?: string; country?: string; region?: string };
    created_at?: string;
  };
  type WorkableResponse = { jobs: WorkableJob[] };

  const data = await tryFetchJson<WorkableResponse>(
    `https://apply.workable.com/api/v3/accounts/${slug}/jobs`
  );
  if (!data || !Array.isArray(data.jobs)) return { jobs: [], totalFound: 0 };

  const totalFound = data.jobs.length;
  const jobs = data.jobs
    .filter((job) => matchesKeywords(job.title, keywords, minCount))
    .slice(0, 50)
    .map((job) => {
      const loc = job.location
        ? [job.location.city, job.location.region, job.location.country]
            .filter(Boolean)
            .join(", ")
        : null;
      return {
        title: job.title,
        location: loc || null,
        url: job.shortlink ?? `https://apply.workable.com/${slug}/j/${job.id}/`,
        description: null,
        postedAt: job.created_at ?? null,
        matchedKeywords: findMatchedKeywords(job.title, keywords, minCount),
      };
    });
  return { jobs, totalFound };
}

// ---------------------------------------------------------------------------
// Workday scraper
// ---------------------------------------------------------------------------

function parseWorkdayDate(str: string | null | undefined): string | null {
  if (!str) return null;
  const lower = str.toLowerCase();
  const now = new Date();
  if (lower.includes("today")) return now.toISOString();
  if (lower.includes("yesterday")) {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d.toISOString();
  }
  const daysMatch = lower.match(/(\d+)\s+day/);
  if (daysMatch) {
    const d = new Date(now);
    d.setDate(d.getDate() - parseInt(daysMatch[1]));
    return d.toISOString();
  }
  const parsed = new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Fetch a single Workday job's description from the public job HTML page (JSON-LD). */
function fetchWorkdayJobDescription(
  tenant: string,
  boardName: string,
  externalPath: string
): Promise<string | null> {
  const url = `https://${tenant}.wd1.myworkdayjobs.com/en-US/${boardName}${externalPath}`;
  return new Promise((resolve) => {
    execFile(
      "curl",
      [
        "-sL", url,
        "-H", "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "-H", "Accept: text/html,application/xhtml+xml,*/*",
        "--max-time", "12",
      ],
      (err, stdout) => {
        if (err || !stdout) { resolve(null); return; }
        try {
          const match = stdout.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
          if (!match) { resolve(null); return; }
          const ld = JSON.parse(match[1]) as Record<string, unknown>;
          const raw = typeof ld.description === "string" ? ld.description : null;
          resolve(raw ? stripHtml(raw) : null);
        } catch {
          resolve(null);
        }
      }
    );
  });
}

async function scrapeWorkday(
  slugWithBoard: string,
  keywords: string[],
  excludeTerms: string[] = [],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; allSeenUrls: string[]; totalFound: number }> {
  const [tenant, board] = slugWithBoard.split("|");
  if (!tenant) return { jobs: [], allSeenUrls: [], totalFound: 0 };

  type WorkdayJob = {
    title: string;
    externalPath: string;
    locationsText?: string;
    postedOn?: string;
  };
  type WorkdayResponse = { total: number; jobPostings: WorkdayJob[] };

  const apiUrl = `https://${tenant}.wd1.myworkdayjobs.com/wday/cxs/${tenant}/jobs/jobs`;
  const boardName = board ?? "External";

  // Phase 1: collect all non-excluded candidate jobs via pagination (no include filter yet)
  const candidates: (WorkdayJob & { url: string })[] = [];
  const allSeenUrls: string[] = [];
  const limit = 20;
  let offset = 0;
  let total = Infinity;

  while (offset < Math.min(total, 800)) {
    const data = await postJson<WorkdayResponse>(apiUrl, { limit, offset });
    console.log(`[workday] ${tenant} offset=${offset} data=${data ? `total=${data.total} postings=${data.jobPostings?.length}` : "null"}`);
    if (!data || !Array.isArray(data.jobPostings) || data.jobPostings.length === 0) break;
    if (total === Infinity && data.total > 0) total = data.total;

    for (const job of data.jobPostings) {
      if (!job.title || !job.externalPath) continue;
      const url = `https://${tenant}.wd1.myworkdayjobs.com/en-US/${boardName}${job.externalPath}`;
      allSeenUrls.push(url);
      if (isTitleExcluded(job.title, excludeTerms)) continue;
      candidates.push({ ...job, url });
    }

    offset += limit;
    if (data.jobPostings.length < limit) break;
    await new Promise(r => setTimeout(r, 300));
  }

  // Phase 2: fetch descriptions in parallel batches, then filter by keywords on description.
  // Skip entirely if no keywords — description fetching is wasteful with nothing to match against.
  if (keywords.length === 0) {
    return { jobs: [], allSeenUrls, totalFound: allSeenUrls.length };
  }

  const BATCH = 10;
  const jobs: ScrapedJob[] = [];

  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const descs = await Promise.all(
      batch.map(job => fetchWorkdayJobDescription(tenant, boardName, job.externalPath))
    );
    for (let j = 0; j < batch.length; j++) {
      const job = batch[j];
      const desc = descs[j];
      // Prefer description for keyword matching; fall back to title if no description
      const matchText = desc || job.title;
      if (!matchesKeywords(matchText, keywords, minCount)) continue;
      jobs.push({
        title: job.title,
        location: job.locationsText ?? null,
        url: job.url,
        description: desc || null,
        postedAt: parseWorkdayDate(job.postedOn),
        matchedKeywords: findMatchedKeywords(matchText, keywords, minCount),
      });
    }
  }

  return { jobs, allSeenUrls, totalFound: allSeenUrls.length };
}

// ---------------------------------------------------------------------------
// HTML fallback scraper
// ---------------------------------------------------------------------------

function extractLinks(
  html: string,
  baseUrl: string
): { href: string; text: string }[] {
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const links: { href: string; text: string }[] = [];
  let match;
  while ((match = re.exec(html)) !== null) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    try {
      const abs = new URL(href, baseUrl).toString();
      links.push({ href: abs, text });
    } catch {
      // skip invalid URLs
    }
  }
  return links;
}

async function scrapeHtml(
  careersUrl: string,
  keywords: string[],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; totalFound: number }> {
  let html: string;
  try {
    const result = await fetchUrl(careersUrl);
    html = result.body;
  } catch (err) {
    console.warn(`[scraper] Failed to fetch ${careersUrl}:`, err);
    return { jobs: [], totalFound: 0 };
  }

  const links = extractLinks(html, careersUrl);
  const jobs: ScrapedJob[] = [];
  const seen = new Set<string>();
  let totalFound = 0;

  const jobKeywords = [
    "job", "career", "position", "role", "engineer", "developer", "manager",
    "designer", "analyst", "specialist", "director", "intern", "apply",
  ];

  // URL segments that indicate non-job content
  const skipPatterns = ["/blog/", "/news/", "/insights/", "/stories/", "/press/", "/about/", "/culture/", "/podcast/"];

  for (const link of links) {
    const lowerHref = link.href.toLowerCase();
    if (skipPatterns.some((p) => lowerHref.includes(p))) continue;
    const combinedText = (link.text + " " + lowerHref).toLowerCase();
    const isJobLink = jobKeywords.some((k) => combinedText.includes(k));
    if (!isJobLink) continue;
    if (seen.has(link.href)) continue;
    seen.add(link.href);
    totalFound++;
    if (!matchesKeywords(link.text, keywords, minCount)) continue;

    jobs.push({
      title: link.text || "Job Opening",
      location: null,
      url: link.href,
      description: null,
      postedAt: null,
      matchedKeywords: findMatchedKeywords(link.text, keywords, minCount),
    });

    if (jobs.length >= 20) break;
  }

  // Also probe common JSON feed paths
  const jsonFeeds = [
    new URL("/api/jobs", careersUrl).toString(),
    new URL("/jobs.json", careersUrl).toString(),
    new URL("/careers.json", careersUrl).toString(),
  ];

  for (const feedUrl of jsonFeeds) {
    try {
      const { body, status } = await fetchUrl(feedUrl, 0, 6000);
      if (status < 200 || status >= 300) continue;
      const parsed = JSON.parse(body);
      const items: unknown[] = Array.isArray(parsed)
        ? parsed
        : parsed?.jobs ?? parsed?.results ?? parsed?.data ?? [];

      for (const item of items.slice(0, 50)) {
        if (typeof item !== "object" || item === null) continue;
        const obj = item as Record<string, unknown>;
        const title = String(obj.title ?? obj.name ?? obj.job_title ?? "");
        if (!title) continue;
        if (!matchesKeywords(title, keywords, minCount)) continue;
        const jobUrl = String(
          obj.url ?? obj.link ?? obj.absolute_url ?? obj.apply_url ?? careersUrl
        );
        const location = obj.location
          ? typeof obj.location === "object"
            ? String((obj.location as Record<string, unknown>).name ?? "")
            : String(obj.location)
          : null;
        const descRaw = stripHtml(String(obj.content ?? obj.description ?? obj.snippet ?? ""));
        jobs.push({
          title,
          location: location || null,
          url: jobUrl,
          description: descRaw || null,
          postedAt: obj.updated_at
            ? String(obj.updated_at)
            : obj.created_at
              ? String(obj.created_at)
              : null,
          matchedKeywords: findMatchedKeywords(title + " " + descRaw, keywords, minCount),
        });
        if (jobs.length >= 30) break;
      }
      if (jobs.length > 0) break;
    } catch {
      // try next feed
    }
  }

  return { jobs, totalFound };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function scrapeJobsFromUrl(
  careersUrl: string,
  companyName: string,
  keywords: string[],
  excludeTerms: string[] = [],
  minKeywordFrequency?: number
): Promise<ScrapeResult> {
  const minCount = minKeywordFrequency;
  // 1. Detect ATS from URL
  const detected = detectAtsFromUrl(careersUrl);
  console.log(
    `[scraper] ${companyName}: URL detection → ${detected.ats} (slug: ${detected.slug})`
  );

  // 2. If URL-based detection found a known ATS, use it
  if (detected.ats !== "html" && detected.slug) {
    const result = await scrapeWithAts(detected.ats, detected.slug, keywords, excludeTerms, minCount);
    if (result.jobs.length > 0) {
      return { jobs: result.jobs, atsDetected: detected.ats, allSeenUrls: result.allSeenUrls, totalFound: result.totalFound };
    }
  }

  // 3. Probe common ATS APIs using the company name slug
  const probed = await probeAts(companyName);
  if (probed) {
    const result = await scrapeWithAts(probed.ats, probed.slug, keywords, excludeTerms, minCount);
    return { jobs: result.jobs, atsDetected: probed.ats, allSeenUrls: result.allSeenUrls, totalFound: result.totalFound };
  }

  // 4. Fall back to HTML scraping
  console.log(`[scraper] ${companyName}: falling back to HTML scraping`);
  const { jobs, totalFound } = await scrapeHtml(careersUrl, keywords, minCount);
  return { jobs, atsDetected: "html", totalFound };
}

async function scrapeWithAts(
  ats: AtsType,
  slug: string,
  keywords: string[],
  excludeTerms: string[] = [],
  minCount?: number
): Promise<{ jobs: ScrapedJob[]; allSeenUrls?: string[]; totalFound: number }> {
  switch (ats) {
    case "greenhouse":
      return scrapeGreenhouse(slug, keywords, excludeTerms, minCount);
    case "lever":
      return scrapeLever(slug, keywords, excludeTerms, minCount);
    case "ashby":
      return scrapeAshby(slug, keywords, excludeTerms, minCount);
    case "workable":
      return scrapeWorkable(slug, keywords, minCount);
    case "workday":
      return scrapeWorkday(slug, keywords, excludeTerms, minCount);
    default:
      return { jobs: [], totalFound: 0 };
  }
}

export function buildGoogleJobsUrl(
  companyName: string,
  keywords: string
): string {
  const query = encodeURIComponent(
    `site:linkedin.com/jobs OR site:greenhouse.io OR site:lever.co "${companyName}" ${keywords}`
  );
  return `https://www.google.com/search?q=${query}`;
}

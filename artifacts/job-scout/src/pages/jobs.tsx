import { useState, useMemo } from "react";
import { Search, Bookmark, CheckCircle2, Download, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { motion } from "framer-motion";
import ExcelJS from "exceljs";
import { useListJobs, useListKeywords, useBatchUpdateJobStatus } from "@workspace/api-client-react";
import { JobRow } from "@/components/ui/job-row";
import { DatePostedDropdown, type DatePostedFilter, cutoffForFilter } from "@/components/ui/date-posted-dropdown";
import { loadLocationState } from "@/lib/location-filter";

const US_STATE_ABBRS = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
]);

const US_KEYWORDS = [
  "united states", "usa", " us ", "u.s.", "u.s.a.", ", us", "us-",
  "new york", "san francisco", "los angeles", "seattle", "chicago",
  "boston", "austin", "denver", "miami", "atlanta", "remote",
  "nyc", "sf bay", "bay area", "silicon valley", "washington dc",
  "washington, d.c", "new jersey", "philadelphia", "phoenix", "dallas",
  "houston", "portland", "minneapolis", "nashville", "charlotte", "raleigh",
];

const NON_US_INDICATORS = [
  "amsterdam", "london", "singapore", "berlin", "paris", "toronto", "tokyo",
  "sydney", "dubai", "bangalore", "bengaluru", "chennai", "hyderabad",
  "mexico", "colombia", "brazil", "argentina", "ireland", "india", "china",
  "hong kong", "emea", "apac", "latam", "uk", "u.k.", "europe",
  "canada", "australia", "luxembourg", "warsaw", "bucharest", "barcelona",
  "madrid", "stockholm", "munich", "zurich", "switzerland", "spain",
  // Ireland-specific (Dublin alone is almost always Dublin, Ireland in fintech job listings)
  "dublin", "ie-",
];

// SF city center coordinates
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;
// Default radius in miles for "SF Bay Area" filter
const SF_RADIUS_MILES = 50;

// Generic area labels that are always considered Bay Area
const SF_AREA_LABELS = ["bay area", "sf bay", "silicon valley", "south bay", "east bay"];

// Lookup table: city/place name → [lat, lng]
const CITY_COORDS: Record<string, [number, number]> = {
  "san francisco": [37.7749, -122.4194],
  "sf": [37.7749, -122.4194],
  "daly city": [37.6879, -122.4702],
  "south san francisco": [37.6547, -122.4077],
  "san bruno": [37.6305, -122.4111],
  "burlingame": [37.5841, -122.3660],
  "san mateo": [37.5630, -122.3255],
  "foster city": [37.5585, -122.2711],
  "redwood city": [37.4852, -122.2364],
  "menlo park": [37.4529, -122.1817],
  "palo alto": [37.4419, -122.1430],
  "mountain view": [37.3861, -122.0839],
  "sunnyvale": [37.3688, -122.0363],
  "santa clara": [37.3541, -121.9552],
  "cupertino": [37.3229, -122.0322],
  "san jose": [37.3382, -121.8863],
  "milpitas": [37.4323, -121.8996],
  "fremont": [37.5485, -121.9886],
  "newark": [37.5296, -122.0402],
  "union city": [37.5934, -122.0438],
  "hayward": [37.6688, -122.0808],
  "castro valley": [37.6946, -122.0858],
  "san leandro": [37.7249, -122.1561],
  "alameda": [37.7652, -122.2416],
  "oakland": [37.8044, -122.2712],
  "berkeley": [37.8716, -122.2727],
  "emeryville": [37.8310, -122.2855],
  "richmond": [37.9358, -122.3478],
  "el cerrito": [37.9238, -122.3177],
  "san pablo": [37.9616, -122.3449],
  "san rafael": [37.9735, -122.5311],
  "novato": [38.1074, -122.5697],
  "mill valley": [37.9060, -122.5449],
  "sausalito": [37.8590, -122.4852],
  "tiburon": [37.8915, -122.4569],
  "corte madera": [37.9254, -122.5244],
  "san anselmo": [37.9754, -122.5616],
  "fairfax": [37.9871, -122.5888],
  "walnut creek": [37.9101, -122.0652],
  "concord": [37.9780, -122.0311],
  "pleasant hill": [37.9479, -122.0608],
  "martinez": [37.9955, -122.1341],
  "pittsburg": [38.0280, -121.8947],
  "antioch": [37.9966, -121.8058],
  "brentwood": [37.9316, -121.6958],
  "san ramon": [37.7799, -121.9780],
  "danville": [37.8216, -121.9996],
  "pleasanton": [37.6624, -121.8747],
  "livermore": [37.6819, -121.7681],
  "dublin": [37.7021, -121.9358],
};

// Haversine distance between two lat/lng points, returns miles
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function isBroadlyUs(location: string | null | undefined): boolean {
  if (!location) return true;
  const loc = location.toLowerCase().trim();
  if (/,\s*united states/.test(loc) && !/\bremote\b/.test(loc)) return false;
  if (/\bremote\b.*(united states|usa|u\.s\.a?\.?)/.test(loc)) return true;
  if (/(united states|usa|u\.s\.a?\.?).*\bremote\b/.test(loc)) return true;
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  if (/^(remote|us|u\.s\.|united states|united states of america)$/.test(loc)) return true;
  if (/\b(usa|u\.s\.a?\.)/.test(loc)) return true;
  if (/^remote[\s\-\(,]*(us|u\.s\.|usa|united states)/i.test(loc)) return true;
  if (/^(us|u\.s\.|usa|united states)[\s\-\(,]*remote/i.test(loc)) return true;
  return false;
}

function splitMultiLocation(locStr: string): string[] {
  if (!/ or /i.test(locStr)) return [locStr.trim()];
  const parts = locStr
    .split(/, (?=[A-Z][a-z]|or )/)
    .map((s) => s.replace(/^or\s+/i, "").trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : [locStr.trim()];
}

function isSfBayArea(location: string | null | undefined, radiusMiles = SF_RADIUS_MILES): boolean {
  if (!location) return false;
  const loc = location.toLowerCase().trim();
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  // Generic area labels that always qualify
  if (SF_AREA_LABELS.some((label) => loc.includes(label))) return true;
  // Try to match any known city and check its distance from SF
  for (const [city, [lat, lng]] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city)) {
      if (haversineDistance(SF_LAT, SF_LNG, lat, lng) <= radiusMiles) return true;
    }
  }
  return false;
}

type LocationState = {
  usRemote: boolean;
  usLocal: boolean;
  city: string;
  radiusMiles: number;
};

// Find coordinates for a user-typed city name
function resolveCityCoords(cityQuery: string): [number, number] | null {
  const q = cityQuery.toLowerCase().trim();
  if (CITY_COORDS[q]) return CITY_COORDS[q];
  const entry = Object.entries(CITY_COORDS).find(([city]) => city.includes(q) || q.includes(city));
  return entry ? entry[1] : null;
}

function isWithinCityRadius(location: string | null | undefined, cityQuery: string, radiusMiles: number): boolean {
  if (!location || !cityQuery.trim()) return false;
  const loc = location.toLowerCase().trim();
  if (NON_US_INDICATORS.some((kw) => loc.includes(kw))) return false;
  const queryCoords = resolveCityCoords(cityQuery);
  if (!queryCoords) return loc.includes(cityQuery.toLowerCase().trim());
  const [queryLat, queryLng] = queryCoords;
  // Generic Bay Area labels: treat as centered on SF
  if (SF_AREA_LABELS.some((label) => loc.includes(label))) {
    return haversineDistance(queryLat, queryLng, SF_LAT, SF_LNG) <= radiusMiles;
  }
  // Check each known city mentioned in the job location
  for (const [city, [lat, lng]] of Object.entries(CITY_COORDS)) {
    if (loc.includes(city)) {
      if (haversineDistance(queryLat, queryLng, lat, lng) <= radiusMiles) return true;
    }
  }
  return loc.includes(cityQuery.toLowerCase().trim());
}

function titleHasNonUsHint(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return NON_US_INDICATORS.some((kw) => t.includes(kw));
}

function matchesLocation(location: string | null | undefined, loc: LocationState, title?: string | null): boolean {
  const anyChecked = loc.usRemote || loc.usLocal;
  if (!anyChecked) return true;
  const segments = location ? splitMultiLocation(location) : [""];
  for (const seg of segments) {
    if (loc.usRemote && isBroadlyUs(seg)) {
      if (seg.toLowerCase() === "remote" && title && titleHasNonUsHint(title)) continue;
      return true;
    }
    if (loc.usLocal && loc.city.trim().length > 0 && isWithinCityRadius(seg, loc.city, loc.radiusMiles)) {
      return true;
    }
  }
  return false;
}

function locationLabel(loc: LocationState): string {
  const parts: string[] = [];
  if (loc.usRemote) parts.push("US Remote");
  if (loc.usLocal && loc.city.trim()) parts.push(`${loc.city.trim()} (${loc.radiusMiles} mi)`);
  if (parts.length === 0) return "All Locations";
  if (parts.length === 1) return parts[0];
  return `${parts.length} locations`;
}

function parseMatchedKeywords(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed as string[])];
  } catch {
    return [];
  }
}

type Tab = "all" | "saved" | "applied";

const STATUS_PRIORITY: Record<string, number> = { applied: 0, saved: 1, new: 2 };

export default function JobsPage() {
  const { data: jobs, isLoading } = useListJobs();
  const { data: keywords, isLoading: keywordsLoading } = useListKeywords();
  const batchUpdate = useBatchUpdateJobStatus();
  const [tab, setTab] = useState<Tab>("all");
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);
  const [filter, setFilter] = useState("");
  const [dateFilter, setDateFilter] = useState<DatePostedFilter>("all");
  const [sortBy, setSortBy] = useState<"company" | "title" | "date">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [location] = useState<LocationState>(loadLocationState);

  const excludeTerms = useMemo(
    () => (keywords ?? []).filter((k) => k.type === "exclude").map((k) => k.term.toLowerCase()),
    [keywords]
  );

  const includeTerms = useMemo(
    () => (keywords ?? []).filter((k) => k.type !== "exclude").map((k) => k.term.toLowerCase()),
    [keywords]
  );

  const filteredByLocation = useMemo(
    () => {
      if (!jobs || keywordsLoading) return [];

      // Pass 1: basic filters
      const cutoff = cutoffForFilter(dateFilter);
      const candidates = jobs.filter((j) => {
        if (j.status === "removed") return false;
        if (!matchesLocation(j.location, location, j.title, j.requireCityMatch)) return false;
        if (cutoff) {
          if (!j.postedAt) return false;
          const d = new Date(j.postedAt);
          if (isNaN(d.getTime()) || d < cutoff) return false;
        }
        if (excludeTerms.length > 0) {
          const title = j.title.toLowerCase();
          if (excludeTerms.some((term) => title.includes(term))) return false;
        }
        // Must match at least one include keyword (if any are defined)
        if (includeTerms.length > 0) {
          const matched = parseMatchedKeywords(j.matchedKeywords).map((kw) => kw.toLowerCase());
          if (!includeTerms.some((term) => matched.includes(term))) return false;
        }
        return true;
      });

      // Pass 2: deduplicate by company+title, keeping the best-status (or newest) entry
      const seen = new Map<string, typeof candidates[number]>();
      for (const j of candidates) {
        const key = `${j.companyName}|||${j.title}`;
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, j);
        } else {
          const existingPriority = STATUS_PRIORITY[existing.status ?? "new"] ?? 2;
          const newPriority = STATUS_PRIORITY[j.status ?? "new"] ?? 2;
          if (newPriority < existingPriority || (newPriority === existingPriority && j.id > existing.id)) {
            seen.set(key, j);
          }
        }
      }
      return Array.from(seen.values());
    },
    [jobs, excludeTerms, includeTerms, keywordsLoading, location, dateFilter]
  );

  const savedJobs = useMemo(
    () => filteredByLocation.filter((j) => j.status === "saved"),
    [filteredByLocation]
  );

  const appliedJobs = useMemo(
    () => filteredByLocation.filter((j) => j.status === "applied"),
    [filteredByLocation]
  );

  const newJobs = useMemo(
    () => filteredByLocation.filter((j) => j.status !== "saved" && j.status !== "applied"),
    [filteredByLocation]
  );

  // All new-status IDs (pre-dedup) so Remove All clears duplicates too
  const allNewJobIds = useMemo(
    () => (jobs ?? [])
      .filter((j) => j.status !== "saved" && j.status !== "applied" && j.status !== "removed")
      .map((j) => j.id),
    [jobs]
  );

  const baseJobs =
    tab === "saved" ? savedJobs :
    tab === "applied" ? appliedJobs :
    newJobs;

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    const base = q
      ? baseJobs.filter(
          (j) =>
            j.title.toLowerCase().includes(q) ||
            j.companyName.toLowerCase().includes(q)
        )
      : baseJobs;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortBy === "company") {
        const co = a.companyName.localeCompare(b.companyName) * dir;
        if (co !== 0) return co;
        return a.title.localeCompare(b.title);
      }
      if (sortBy === "title") {
        return a.title.localeCompare(b.title) * dir;
      }
      // date
      const da = a.postedAt ? new Date(a.postedAt).getTime() : 0;
      const db = b.postedAt ? new Date(b.postedAt).getTime() : 0;
      return (da - db) * dir;
    });
  }, [baseJobs, filter, sortBy, sortDir]);

  const isFiltered = filter.trim().length > 0;

  function buildRows(source: typeof jobs) {
    return (source ?? []).map((j) => ({
      id: j.id,
      search_id: j.searchId,
      company_name: j.companyName,
      title: j.title,
      location: j.location ?? "",
      url: j.url ?? "",
      description: j.description ?? "",
      posted_at: j.postedAt ?? "",
      created_at: j.createdAt ?? "",
      matched_keywords: j.matchedKeywords ?? "",
      status: j.status ?? "new",
    }));
  }

  async function writeExcel(rows: ReturnType<typeof buildRows>, filename: string) {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Jobs");
    ws.columns = [
      { header: "id",               key: "id",               width: 8  },
      { header: "search_id",        key: "search_id",        width: 10 },
      { header: "company_name",     key: "company_name",     width: 22 },
      { header: "title",            key: "title",            width: 40 },
      { header: "location",         key: "location",         width: 28 },
      { header: "url",              key: "url",              width: 60 },
      { header: "description",      key: "description",      width: 80 },
      { header: "posted_at",        key: "posted_at",        width: 20 },
      { header: "created_at",       key: "created_at",       width: 20 },
      { header: "matched_keywords", key: "matched_keywords", width: 30 },
      { header: "status",           key: "status",           width: 10 },
    ];
    ws.addRows(rows);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const today = new Date().toISOString().slice(0, 10);

  function exportFiltered() {
    const label = locationLabel(location).replace(/[^a-z0-9]/gi, "_");
    void writeExcel(buildRows(filtered), `all_jobs_${label}_${today}.xlsx`);
  }

  function exportAll() {
    void writeExcel(buildRows(jobs), `all_jobs_${today}.xlsx`);
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "all",     label: "New Jobs",  count: newJobs.length },
    { id: "saved",   label: "Saved",     count: savedJobs.length },
    { id: "applied", label: "Applied",   count: appliedJobs.length },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>Job Feed</h2>
          <p className="text-sm" style={{ color: "#9a8060" }}>Review and tag newly discovered roles.</p>
        </div>
        <button
          onClick={exportAll}
          disabled={!jobs || jobs.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "#4d7435", color: "white" }}
        >
          <Download className="w-4 h-4" />
          Export All
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setFilter(""); setConfirmRemoveAll(false); }}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg ${
              tab === t.id
                ? "text-primary"
                : "text-muted-foreground hover:text-primary"
            }`}
          >
            {t.id === "saved"   && <Bookmark     className="w-3.5 h-3.5" />}
            {t.id === "applied" && <CheckCircle2 className="w-3.5 h-3.5" />}
            {t.label}
            <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold ${
              tab === t.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}>
              {t.count}
            </span>
            {tab === t.id && (
              <motion.div
                layoutId="tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
              />
            )}
          </button>
        ))}

      </div>

      {/* Search + date filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by title or company…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full h-10 pl-12 pr-4 text-sm rounded-xl border border-border text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors shadow-sm" style={{ background: "#fffef4" }}
          />
        </div>
        <DatePostedDropdown value={dateFilter} onChange={setDateFilter} />
        {tab === "all" && newJobs.length > 0 && (
          <button
            onClick={() => {
              if (!confirmRemoveAll) { setConfirmRemoveAll(true); return; }
              batchUpdate.mutate(
                { ids: allNewJobIds, status: "removed" },
                { onSuccess: () => setConfirmRemoveAll(false) }
              );
            }}
            onBlur={() => setTimeout(() => setConfirmRemoveAll(false), 150)}
            disabled={batchUpdate.isPending}
            className="inline-flex items-center gap-2 px-4 h-10 rounded-xl font-semibold text-sm transition-all whitespace-nowrap disabled:opacity-50"
            style={confirmRemoveAll
              ? { background: "#c0392b", color: "white" }
              : { background: "#f5ece0", color: "#9a8060", border: "1px solid #e4cd99" }}
          >
            <Trash2 className="w-4 h-4" />
            {confirmRemoveAll ? "Confirm?" : "Remove all"}
          </button>
        )}
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2 -mt-2">
        <span className="text-xs text-muted-foreground">Sort:</span>
        {(["company", "title", "date"] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => {
              if (sortBy === opt) {
                setSortDir((d) => (d === "asc" ? "desc" : "asc"));
              } else {
                setSortBy(opt);
                setSortDir(opt === "date" ? "desc" : "asc");
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              sortBy === opt
                ? "bg-primary/15 text-primary border border-primary/30"
                : "bg-muted/50 text-muted-foreground hover:text-card-foreground border border-transparent"
            }`}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
            {sortBy === opt && (
              sortDir === "asc"
                ? <ArrowUp className="w-3 h-3" />
                : <ArrowDown className="w-3 h-3" />
            )}
          </button>
        ))}
      </div>

      {/* Job list */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-5 bg-card border border-border rounded-2xl">
              <div className="w-36 h-4 bg-muted rounded animate-pulse" />
              <div className="flex-1 h-4 bg-muted rounded animate-pulse" />
              <div className="w-20 h-4 bg-muted rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((job, idx) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.02, 0.3) }}
            >
              <JobRow
                job={job}
                matchedKeywords={parseMatchedKeywords(job.matchedKeywords).filter((kw) => includeTerms.includes(kw.toLowerCase()))}
                locationFilter={location}
              />
            </motion.div>
          ))}
        </div>
      ) : tab === "saved" ? (
        <div className="bg-card border-2 border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4 text-5xl">
            🔖
          </div>
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">No saved jobs yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Tag a listing as <span className="font-semibold">Saved</span> from the All Jobs tab to track it here.
          </p>
        </div>
      ) : tab === "applied" ? (
        <div className="bg-card border-2 border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4 text-5xl">
            ✅
          </div>
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">No applications tracked yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Tag a listing as <span className="font-semibold">Applied</span> to track it here.
          </p>
        </div>
      ) : jobs && jobs.length === 0 ? (
        <div className="bg-card border-2 border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4 text-5xl">
            🐒
          </div>
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">No jobs yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Run a scan from the Dashboard to start finding job listings.
          </p>
        </div>
      ) : (
        <div className="bg-card border-2 border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-4xl">
            🙈
          </div>
          <h3 className="text-lg font-display font-semibold text-foreground mb-2">No matches</h3>
          <p className="text-muted-foreground">Try a different filter term.</p>
        </div>
      )}
    </div>
  );
}

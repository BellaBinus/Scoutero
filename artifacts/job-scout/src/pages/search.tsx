import { useState, useRef, useEffect } from "react";
import { Play, Loader2, ArrowRight, ChevronDown, Check, Building2, Search } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListCompanies,
  useListKeywords,
  useRunSearch,
  getListJobsQueryKey,
  type SearchWithJobs,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { loadLocationState, saveLocationState, matchesLocation, type LocationState } from "@/lib/location-filter";
import { LocationDropdown } from "@/components/ui/location-dropdown";
import { DatePostedDropdown, type DatePostedFilter } from "@/components/ui/date-posted-dropdown";


function CompanyDropdown({
  companies,
  selectedIds,
  onChange,
}: {
  companies: { id: number; name: string }[];
  selectedIds: Set<number>;
  onChange: (ids: Set<number>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const sorted = [...companies].sort((a, b) => {
    const aSelected = selectedIds.has(a.id);
    const bSelected = selectedIds.has(b.id);
    if (aSelected !== bSelected) return aSelected ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  const filtered = query.trim()
    ? sorted.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
    : sorted;
  const firstUnselectedIdx = filtered.findIndex((c) => !selectedIds.has(c.id));

  const allSelected = selectedIds.size === companies.length;
  const noneSelected = selectedIds.size === 0;

  const toggleAll = () => {
    onChange(allSelected ? new Set() : new Set(companies.map((c) => c.id)));
  };

  const toggle = (id: number) => {
    if (query.trim()) {
      // While filtering: always add to selection, clear search, keep open for next pick
      const next = new Set(selectedIds);
      next.add(id);
      onChange(next);
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 30);
      return;
    }
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  const label = noneSelected
    ? "No companies selected"
    : allSelected
    ? "All companies"
    : `${selectedIds.size} companies`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "#fffef4" }}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-card-foreground text-sm font-medium transition-all",
          "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
          open ? "border-primary/40 ring-2 ring-primary/20" : "border-border",
          noneSelected && "text-destructive border-destructive/40"
        )}
      >
        <Building2 className="w-4 h-4 text-card-foreground/50 shrink-0" />
        <span className="min-w-[5rem] text-left truncate">{label}</span>
        <ChevronDown className={cn("w-4 h-4 text-card-foreground/40 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 z-50 border border-border rounded-xl shadow-xl min-w-[16rem]"
            style={{ background: "#fffef4" }}
          >
            {/* Search input */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
              <Search className="w-3.5 h-3.5 text-card-foreground/40 shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => {
                  const val = e.target.value;
                  // First keystroke while all are selected → deselect all so picks are meaningful
                  if (val.trim() && allSelected) onChange(new Set());
                  setQuery(val);
                }}
                onKeyDown={(e) => e.key === "Escape" && (setOpen(false), setQuery(""))}
                placeholder="Search companies…"
                className="flex-1 text-sm bg-transparent outline-none text-card-foreground placeholder:text-card-foreground/35"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-card-foreground/30 hover:text-card-foreground/60 transition-colors text-xs leading-none"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Select All — hidden while filtering */}
            {!query && (
              <button
                type="button"
                onClick={toggleAll}
                className="flex items-center gap-3 w-full px-4 py-3 text-sm font-semibold text-card-foreground hover:bg-primary/5 transition-colors border-b border-border"
              >
                <div className={cn(
                  "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                  allSelected ? "bg-primary border-primary" : "border-card-foreground/30"
                )}>
                  {allSelected && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                </div>
                Select all
              </button>
            )}

            {/* Company list */}
            <div className="max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-3 text-sm text-card-foreground/40 italic">No matches</p>
              ) : (
                filtered.map((company, idx) => (
                  <div key={company.id}>
                    {idx === firstUnselectedIdx && firstUnselectedIdx > 0 && (
                      <div className="mx-3 my-1 border-t border-border/60" />
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(company.id)}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-card-foreground hover:bg-primary/5 transition-colors"
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                        selectedIds.has(company.id) ? "bg-primary border-primary" : "border-card-foreground/30"
                      )}>
                        {selectedIds.has(company.id) && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                      </div>
                      {company.name}
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SearchPage() {
  const [results, setResults] = useState<SearchWithJobs | null>(null);
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<Set<number> | null>(null);
  const [location, setLocation] = useState<LocationState>(loadLocationState);
  const [dateFilter, setDateFilter] = useState<DatePostedFilter>("all");
  const queryClient = useQueryClient();

  useEffect(() => {
    saveLocationState(location);
  }, [location]);

  const { data: companies, isLoading: isLoadingCompanies } = useListCompanies();
  const { data: keywords, isLoading: isLoadingKeywords } = useListKeywords();
  const runSearch = useRunSearch();

  const effectiveSelection = selectedCompanyIds !== null
    ? selectedCompanyIds
    : new Set((companies ?? []).map((c) => c.id));
  const canRun =
    (companies?.length ?? 0) > 0 &&
    (keywords?.length ?? 0) > 0 &&
    (selectedCompanyIds === null || selectedCompanyIds.size > 0);

  const handleScan = () => {
    if (!canRun) return;
    const allKeywords = keywords!.filter((k) => k.type !== "exclude").map((k) => k.term).join(" ");
    const companyIds = Array.from(effectiveSelection);
    runSearch.mutate(
      { data: { keywords: allKeywords, companyIds, location } },
      {
        onSuccess: (response) => {
          setResults(response);
          queryClient.invalidateQueries({ queryKey: getListJobsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>Scout roles in real time 🐒</h2>
        <p className="text-sm" style={{ color: "#9a8060" }}>Find fintech roles faster — no job boards, no delays!</p>
      </div>

      {/* Scan card */}
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider" style={{ background: "#4d7435", color: "white" }}>Set your scouting range</span>
      <div className="rounded-2xl shadow-sm -mt-2" style={{ background: "white", border: "1.5px solid #e4cd99" }}>
        <div className="p-5 space-y-4">
          {/* Controls row — wraps on narrow viewports */}
          <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
            {companies && companies.length > 0 && (
              <div className="space-y-1.5 flex flex-col min-w-0">
                <label className="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "#4d7435" }}>Target Companies</label>
                <CompanyDropdown
                  companies={companies}
                  selectedIds={effectiveSelection}
                  onChange={setSelectedCompanyIds}
                />
              </div>
            )}
            <div className="space-y-1.5 flex flex-col min-w-0">
              <label className="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "#4d7435" }}>Location Focus</label>
              <LocationDropdown value={location} onChange={setLocation} />
            </div>
            <div className="space-y-1.5 flex flex-col min-w-0">
              <label className="text-xs font-bold uppercase tracking-wider whitespace-nowrap" style={{ color: "#4d7435" }}>Date Range</label>
              <DatePostedDropdown value={dateFilter} onChange={setDateFilter} />
            </div>
            <div className="flex flex-col shrink-0 justify-end">
              <Link href="/keywords">
                <div className="flex items-center gap-1.5 py-2.5 text-sm font-semibold transition-all hover:opacity-70 cursor-pointer whitespace-nowrap" style={{ color: "#b55a8a" }}>
                  <span>Edit Keywords</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </div>
              </Link>
            </div>
          </div>

          {!canRun && !isLoadingCompanies && !isLoadingKeywords && (
            <p className="text-sm" style={{ color: "#9a8060" }}>
              {(companies?.length ?? 0) === 0 && (keywords?.length ?? 0) === 0
                ? "Add target companies and search keywords to get started."
                : (companies?.length ?? 0) === 0
                ? "Add at least one target company to run a scan."
                : effectiveSelection.size === 0
                ? "Select at least one company to scan."
                : "Add at least one keyword to run a scan."}
            </p>
          )}
        </div>
      </div>

      {/* Scout Now pill button — standalone below the card */}
      <div className="flex justify-center">
        <button
          onClick={handleScan}
          disabled={runSearch.isPending || !canRun}
          style={{ background: "#4d7435", boxShadow: "0 4px 20px rgba(77,116,53,0.35)" }}
          className={cn(
            "h-12 px-10 rounded-full font-bold text-base flex items-center justify-center gap-2.5 text-white transition-all duration-200",
            "hover:scale-105 hover:shadow-xl",
            "active:scale-95 active:shadow-md",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          )}
        >
          {runSearch.isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Play className="w-5 h-5 fill-white" />
              Scout Now
            </>
          )}
        </button>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
        {results && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center"
          >
            {(() => {
              // Mirror the stat card exactly: location → exclude terms → matched keywords → dedup → status "new"
              const excludeTerms = (keywords ?? []).filter(k => k.type === "exclude").map(k => k.term.toLowerCase());
              const includeTerms = (keywords ?? []).filter(k => k.type !== "exclude").map(k => k.term.toLowerCase());
              const parseKws = (raw: string | null | undefined): string[] => {
                try { return raw ? JSON.parse(raw) : []; } catch { return []; }
              };
              const candidates = results.jobs.filter(j => {
                if (j.status === "removed") return false;
                if ((location.usRemote || location.usLocal) && !matchesLocation(j.location, location, j.title, j.requireCityMatch)) return false;
                if (excludeTerms.length > 0 && excludeTerms.some(t => j.title.toLowerCase().includes(t))) return false;
                if (includeTerms.length > 0) {
                  const matched = parseKws(j.matchedKeywords).map(k => k.toLowerCase());
                  if (!includeTerms.some(t => matched.includes(t))) return false;
                }
                return true;
              });
              const seen = new Map<string, typeof candidates[number]>();
              const statusPriority: Record<string, number> = { applied: 0, saved: 1, new: 2 };
              for (const j of candidates) {
                const key = `${j.companyName}|||${j.title}`;
                const existing = seen.get(key);
                if (!existing) { seen.set(key, j); continue; }
                const ep = statusPriority[existing.status ?? "new"] ?? 2;
                const np = statusPriority[j.status ?? "new"] ?? 2;
                if (np < ep || (np === ep && j.id > existing.id)) seen.set(key, j);
              }
              const count = Array.from(seen.values()).filter(j => j.status === "new").length;
              return count > 0 ? (
                <Link href="/jobs">
                  <span className="text-base font-semibold transition-opacity hover:opacity-70 cursor-pointer" style={{ color: "#4d7435" }}>
                    {count} new job{count !== 1 ? "s" : ""} matching your filters were found →
                  </span>
                </Link>
              ) : (
                <span className="text-base" style={{ color: "#9a8060" }}>
                  No jobs matching your filters were found.
                </span>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

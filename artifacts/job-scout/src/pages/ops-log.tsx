import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { AlertTriangle, CheckCircle2, XCircle, ChevronRight, Download, Activity } from "lucide-react";
import ExcelJS from "exceljs";

interface ScanLogRow {
  id: number;
  searchId: number;
  companyId: number;
  companyName: string;
  scannedAt: string;
  totalJobsFound: number;
  matchedJobsFound: number;
  preDedupeCount: number;
  newListings: number;
  isAdminScan: boolean;
  newJobsFound: number | null;
  durationMs: number | null;
  atsDetected: string | null;
  error: string | null;
}

interface OpsLogResponse {
  rows: ScanLogRow[];
  flaggedCompanyIds: number[];
  healthScanRunning: boolean;
}

interface ScanGroup {
  searchId: number;
  timestamp: string;
  companies: ScanLogRow[];
  isAdminScan: boolean;
  totalJobsFound: number;
  totalNewJobsFound: number;
  hasNewJobsData: boolean;
  totalPreDedupe: number;
  totalNewListings: number;
  totalDurationMs: number;
  errorCount: number;
}

async function fetchOpsLog(): Promise<OpsLogResponse> {
  const res = await fetch("/api/admin/ops-log");
  if (!res.ok) throw new Error("Failed to fetch ops log");
  return res.json();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function formatTs(iso: string) {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yy} ${hh}:${min}`;
}

function AtsTag({ ats }: { ats: string | null }) {
  if (!ats) return <span style={{ color: "#c8b88a" }}>—</span>;
  const colors: Record<string, { bg: string; color: string }> = {
    greenhouse: { bg: "#e8f5e9", color: "#2e7d32" },
    ashby:      { bg: "#e8eaf6", color: "#3949ab" },
    lever:      { bg: "#fff3e0", color: "#e65100" },
    workday:    { bg: "#fce4ec", color: "#c62828" },
    workable:   { bg: "#e0f2f1", color: "#00695c" },
    bamboohr:   { bg: "#f3e5f5", color: "#6a1b9a" },
    html:       { bg: "#f5f5f5", color: "#616161" },
  };
  const style = colors[ats] ?? { bg: "#f0f0f0", color: "#444" };
  return (
    <span
      className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {ats}
    </span>
  );
}

function groupBySearch(rows: ScanLogRow[]): ScanGroup[] {
  const map = new Map<number, ScanGroup>();
  for (const row of rows) {
    if (!map.has(row.searchId)) {
      map.set(row.searchId, {
        searchId: row.searchId,
        timestamp: row.scannedAt,
        companies: [],
        isAdminScan: row.isAdminScan,
        totalJobsFound: 0,
        totalNewJobsFound: 0,
        hasNewJobsData: false,
        totalPreDedupe: 0,
        totalNewListings: 0,
        totalDurationMs: 0,
        errorCount: 0,
      });
    }
    const g = map.get(row.searchId)!;
    g.companies.push(row);
    g.totalJobsFound += row.totalJobsFound;
    if (row.newJobsFound !== null) {
      g.totalNewJobsFound += row.newJobsFound;
      g.hasNewJobsData = true;
    }
    g.totalPreDedupe += row.preDedupeCount;
    g.totalNewListings += row.newListings;
    g.totalDurationMs += row.durationMs ?? 0;
    if (row.error) g.errorCount++;
    // Use earliest timestamp as the scan timestamp
    if (new Date(row.scannedAt) < new Date(g.timestamp)) {
      g.timestamp = row.scannedAt;
    }
  }
  // Sort by timestamp descending (most recent first)
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

async function downloadExcel(groups: ScanGroup[]) {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Scan summaries
  const summarySheet = wb.addWorksheet("Scan Summaries");
  summarySheet.columns = [
    { header: "Timestamp",   key: "Timestamp",   width: 16 },
    { header: "Companies",   key: "Companies",   width: 11 },
    { header: "New Jobs",    key: "New Jobs",    width: 10 },
    { header: "New Matches", key: "New Matches", width: 14 },
    { header: "Duration",    key: "Duration",    width: 12 },
    { header: "Errors",      key: "Errors",      width: 8  },
  ];
  for (const g of groups) {
    summarySheet.addRow({
      "Timestamp":   formatTs(g.timestamp),
      "Companies":   g.companies.length,
      "New Jobs":    g.totalPreDedupe,
      "New Matches": g.totalNewListings,
      "Duration":    formatDuration(g.totalDurationMs),
      "Errors":      g.errorCount,
    });
  }

  // Sheet 2: Per-company detail
  const detailSheet = wb.addWorksheet("Company Detail");
  detailSheet.columns = [
    { header: "Scan Timestamp", key: "Scan Timestamp", width: 16 },
    { header: "Search ID",      key: "Search ID",      width: 10 },
    { header: "Company",        key: "Company",        width: 22 },
    { header: "ATS",            key: "ATS",            width: 12 },
    { header: "New Jobs",       key: "New Jobs",       width: 10 },
    { header: "New Matches",    key: "New Matches",    width: 14 },
    { header: "Duration (ms)",  key: "Duration (ms)",  width: 14 },
    { header: "Status",         key: "Status",         width: 32 },
  ];
  for (const g of groups) {
    for (const c of g.companies) {
      detailSheet.addRow({
        "Scan Timestamp": formatTs(g.timestamp),
        "Search ID":      g.searchId,
        "Company":        c.companyName,
        "ATS":            c.atsDetected ?? "",
        "New Jobs":       c.preDedupeCount,
        "New Matches":    c.newListings,
        "Duration (ms)":  c.durationMs ?? "",
        "Status":         c.error ? `Error: ${c.error}` : "OK",
      });
    }
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `ops-log-${date}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function OpsLogPage() {
  const [, navigate] = useLocation();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [healthScanLoading, setHealthScanLoading] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) navigate("/");
  }, [adminLoading, isAdmin, navigate]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["ops-log"],
    queryFn: fetchOpsLog,
    staleTime: 60 * 1000,
    enabled: isAdmin,
    refetchInterval: (query) => {
      return query.state.data?.healthScanRunning ? 8000 : false;
    },
  });

  const runHealthScan = useCallback(async () => {
    setHealthScanLoading(true);
    try {
      await fetch("/api/admin/health-scan", { method: "POST" });
      refetch();
    } finally {
      setHealthScanLoading(false);
    }
  }, [refetch]);

  if (adminLoading || (!adminLoading && !isAdmin)) return null;

  const flaggedIds = new Set(data?.flaggedCompanyIds ?? []);
  const serverRunning = data?.healthScanRunning ?? false;
  const scanBusy = healthScanLoading || serverRunning;
  const rows = data?.rows ?? [];
  const groups = groupBySearch(rows);

  const flaggedCompanies = rows
    .filter((r) => flaggedIds.has(r.companyId))
    .reduce((acc, r) => {
      if (!acc.find((c) => c.companyId === r.companyId)) {
        acc.push({ companyId: r.companyId, companyName: r.companyName });
      }
      return acc;
    }, [] as { companyId: number; companyName: string }[]);

  function toggleExpand(searchId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(searchId)) next.delete(searchId);
      else next.add(searchId);
      return next;
    });
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>
            Ops Log
          </h2>
          <p className="text-sm" style={{ color: "#9a8060" }}>
            Scan history and health monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void downloadExcel(groups)}
            disabled={groups.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40"
            style={{ background: "rgba(77,116,53,0.12)", color: "#4d7435", border: "1.5px solid rgba(77,116,53,0.3)" }}
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={runHealthScan}
            disabled={scanBusy}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-50"
            style={{ background: "rgba(196,112,153,0.12)", color: "#9b4a7a", border: "1.5px solid rgba(196,112,153,0.35)" }}
          >
            <Activity className={`w-4 h-4 ${scanBusy ? "animate-pulse" : ""}`} />
            {scanBusy ? "Scanning…" : "Health scan"}
          </button>
        </div>
      </div>

      {/* Flagged alert */}
      {flaggedCompanies.length > 0 && (
        <div
          className="rounded-2xl px-5 py-4 flex gap-3 items-start"
          style={{ background: "#fff3cd", border: "1.5px solid #ffc107" }}
        >
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" style={{ color: "#e65100" }} />
          <div>
            <p className="font-semibold text-sm mb-1" style={{ color: "#7a3e00" }}>
              Zero-result alert — no ATS listings found in 7 days of health scans
            </p>
            <p className="text-xs" style={{ color: "#7a3e00" }}>
              These companies returned 0 total listings across all health scans this week — likely an ATS change, scraper issue, or the page is down.
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {flaggedCompanies.map((c) => (
                <li
                  key={c.companyId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "#ffe0a0", color: "#7a3e00", border: "1px solid #ffc107" }}
                >
                  ⚠ {c.companyName}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Scan list */}
      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: "rgba(228,205,153,0.3)" }} />
          ))}
        </div>
      ) : error ? (
        <div className="border-2 border-dashed border-border rounded-3xl p-12 text-center">
          <p className="text-muted-foreground">Failed to load ops log.</p>
        </div>
      ) : groups.length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-4xl">📋</div>
          <h3 className="text-lg font-display font-semibold mb-2" style={{ color: "#3a2c10" }}>No scans recorded yet</h3>
          <p className="text-muted-foreground">Run a scan from Scout HQ to start logging results.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((group) => {
            const isOpen = expanded.has(group.searchId);
            const hasErrors = group.errorCount > 0;
            const hasFlagged = group.companies.some((c) => flaggedIds.has(c.companyId));
            return (
              <div
                key={group.searchId}
                className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid #e4cd99" }}
              >
                {/* Summary row */}
                <button
                  onClick={() => toggleExpand(group.searchId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    background: isOpen ? "#f5e8c4" : "rgba(255,254,244,0.95)",
                  }}
                >
                  {/* Expand icon */}
                  <ChevronRight
                    className="w-4 h-4 shrink-0 transition-transform"
                    style={{
                      color: "#9a8060",
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  />

                  {/* ── Desktop: original single-line (md+) ── */}
                  <div className="hidden md:flex items-center gap-2 text-sm tabular-nums flex-1 min-w-0" style={{ color: "#7a6030" }}>
                    <span className="shrink-0">{formatTs(group.timestamp)}</span>
                    {group.isAdminScan && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                        style={{ background: "rgba(196,112,153,0.15)", color: "#9b4a7a", border: "1px solid rgba(196,112,153,0.35)" }}
                      >
                        <Activity className="w-3 h-3" />
                        health scan
                      </span>
                    )}
                    <span>·</span>
                    <span className="shrink-0">{group.companies.length} companies</span>
                    <span>·</span>
                    {group.isAdminScan ? (
                      group.hasNewJobsData ? (
                        <>
                          <span className="shrink-0 font-semibold" style={{ color: "#4d7435" }}>{group.totalNewJobsFound} new</span>
                          <span>·</span>
                          <span className="shrink-0">{group.totalJobsFound} total</span>
                        </>
                      ) : (
                        <span className="shrink-0">{group.totalJobsFound} total found</span>
                      )
                    ) : (
                      <>
                        <span className="shrink-0">{group.totalPreDedupe} new jobs</span>
                        <span>·</span>
                        <span className="shrink-0">{group.totalNewListings} new matches</span>
                      </>
                    )}
                    <span>·</span>
                    <span className="shrink-0">{formatDuration(group.totalDurationMs)}</span>
                    {hasErrors && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 shrink-0" style={{ color: "#c62828" }}>
                          <XCircle className="w-3.5 h-3.5" />
                          {group.errorCount} {group.errorCount === 1 ? "error" : "errors"}
                        </span>
                      </>
                    )}
                    {hasFlagged && !hasErrors && (
                      <>
                        <span>·</span>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: "#e65100" }} />
                      </>
                    )}
                  </div>

                  {/* ── Mobile: two-line (hidden on md+) ── */}
                  <div className="md:hidden flex flex-col gap-0.5 flex-1 min-w-0" style={{ color: "#7a6030" }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium tabular-nums shrink-0">{formatTs(group.timestamp)}</span>
                      {group.isAdminScan ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                          style={{ background: "rgba(196,112,153,0.15)", color: "#9b4a7a", border: "1px solid rgba(196,112,153,0.35)" }}
                        >
                          <Activity className="w-3 h-3" />
                          health scan
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold shrink-0"
                          style={{ background: "rgba(77,116,53,0.1)", color: "#4d7435", border: "1px solid rgba(77,116,53,0.25)" }}
                        >
                          user scan
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs flex-wrap tabular-nums" style={{ color: "#9a8060" }}>
                      <span>{group.companies.length} co.</span>
                      <span>·</span>
                      {group.isAdminScan ? (
                        group.hasNewJobsData ? (
                          <>
                            <span className="font-semibold" style={{ color: "#4d7435" }}>{group.totalNewJobsFound} new</span>
                            <span>·</span>
                            <span>{group.totalJobsFound} total</span>
                          </>
                        ) : (
                          <span>{group.totalJobsFound} total</span>
                        )
                      ) : (
                        <>
                          <span>{group.totalPreDedupe} new jobs</span>
                          <span>·</span>
                          <span className="font-semibold" style={{ color: "#4d7435" }}>{group.totalNewListings} matches</span>
                        </>
                      )}
                      <span>·</span>
                      <span>{formatDuration(group.totalDurationMs)}</span>
                      {hasErrors && (
                        <>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1" style={{ color: "#c62828" }}>
                            <XCircle className="w-3 h-3" />
                            {group.errorCount} err
                          </span>
                        </>
                      )}
                      {hasFlagged && !hasErrors && (
                        <>
                          <span>·</span>
                          <AlertTriangle className="w-3 h-3" style={{ color: "#e65100" }} />
                        </>
                      )}
                    </div>
                  </div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #e4cd99" }}>
                    <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead>
                        <tr style={{ background: "#fdf6e3", borderBottom: "1px solid #e4cd99" }}>
                          <th className="text-left px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>Company</th>
                          <th className="text-left px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>ATS</th>
                          {group.isAdminScan ? (
                            <>
                              <th className="text-right px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>New</th>
                              <th className="text-right px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>Total</th>
                            </>
                          ) : (
                            <>
                              <th className="text-right px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>New jobs</th>
                              <th className="text-right px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>New matches</th>
                            </>
                          )}
                          <th className="text-right px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>Duration</th>
                          <th className="text-left px-4 py-2 font-semibold" style={{ color: "#9a8060" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.companies.map((row, idx) => {
                          const isFlagged = flaggedIds.has(row.companyId);
                          const hasError = !!row.error;
                          return (
                            <tr
                              key={row.id}
                              style={{
                                background: idx % 2 === 0 ? "rgba(255,254,244,0.6)" : "rgba(245,232,196,0.2)",
                                borderBottom: "1px solid rgba(228,205,153,0.3)",
                              }}
                            >
                              <td className="px-4 py-2 font-medium" style={{ color: "#3a2c10" }}>
                                <span className="flex items-center gap-1.5">
                                  {isFlagged && (
                                    <AlertTriangle className="w-3 h-3 shrink-0" style={{ color: "#e65100" }} />
                                  )}
                                  {row.companyName}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <AtsTag ats={row.atsDetected} />
                              </td>
                              {group.isAdminScan ? (
                                <>
                                  <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: row.newJobsFound != null && row.newJobsFound > 0 ? "#4d7435" : "#c8b88a" }}>
                                    {row.newJobsFound != null ? row.newJobsFound : "—"}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: row.totalJobsFound > 0 ? "#3a2c10" : "#c8b88a" }}>
                                    {row.totalJobsFound}
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-4 py-2 text-right tabular-nums" style={{ color: row.preDedupeCount > 0 ? "#3a2c10" : "#c8b88a" }}>
                                    {row.preDedupeCount}
                                  </td>
                                  <td className="px-4 py-2 text-right tabular-nums font-semibold" style={{ color: row.newListings > 0 ? "#4d7435" : "#c8b88a" }}>
                                    {row.newListings}
                                  </td>
                                </>
                              )}
                              <td className="px-4 py-2 text-right tabular-nums">
                                {row.durationMs == null ? (
                                  <span style={{ color: "#c8b88a" }}>—</span>
                                ) : row.durationMs > 30000 ? (
                                  <span className="inline-flex items-center justify-end gap-1 font-semibold" style={{ color: "#c62828" }}>
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    {formatDuration(row.durationMs)}
                                  </span>
                                ) : row.durationMs > 10000 ? (
                                  <span className="font-semibold" style={{ color: "#e65100" }}>
                                    {formatDuration(row.durationMs)}
                                  </span>
                                ) : (
                                  <span style={{ color: "#7a6030" }}>
                                    {formatDuration(row.durationMs)}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2">
                                {hasError ? (
                                  <span className="inline-flex items-center gap-1 font-medium" style={{ color: "#c62828" }}>
                                    <XCircle className="w-3 h-3" />
                                    <span className="truncate max-w-[160px]" title={row.error ?? ""}>{row.error}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-medium" style={{ color: "#4d7435" }}>
                                    <CheckCircle2 className="w-3 h-3" />
                                    OK
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

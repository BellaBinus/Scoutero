import { Link } from "wouter";
import { History as HistoryIcon, Briefcase } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useListSearches } from "@workspace/api-client-react";

export default function HistoryPage() {
  const { data: searches, isLoading } = useListSearches();

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>Search History</h2>
        <p className="text-sm" style={{ color: "#9a8060" }}>A log of every scan run across your target companies.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-card rounded-2xl border border-border animate-pulse" />
          ))}
        </div>
      ) : searches && searches.length > 0 ? (
        <div className="flex flex-col gap-3">
          {[...searches].reverse().map((search) => (
            <Link
              key={search.id}
              href={`/history/${search.id}`}
              className="group bg-card border border-border rounded-2xl hover:bg-primary/5 hover:border-primary/30 transition-colors shadow-sm"
            >
              {/* Mobile layout — 2 rows */}
              <div className="md:hidden px-5 py-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="font-semibold text-sm leading-snug"
                    style={{ color: "#4d7435" }}
                    title={format(new Date(search.createdAt), "PPpp")}
                  >
                    {format(new Date(search.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-primary shrink-0">
                    <Briefcase className="w-4 h-4" />
                    {search.jobCount} matches
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <HistoryIcon className="w-3 h-3 shrink-0" />
                  {formatDistanceToNow(new Date(search.createdAt), { addSuffix: true })}
                </div>
              </div>

              {/* Desktop layout — single row */}
              <div className="hidden md:flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <HistoryIcon className="w-4 h-4 shrink-0" />
                  <span
                    className="font-medium"
                    style={{ color: "#4d7435" }}
                    title={format(new Date(search.createdAt), "PPpp")}
                  >
                    {format(new Date(search.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(search.createdAt), { addSuffix: true })}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <Briefcase className="w-4 h-4" />
                  {search.jobCount} matches
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-card border-2 border-dashed border-border rounded-3xl p-12 text-center flex flex-col items-center">
          <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4 text-5xl">
            🐒
          </div>
          <h3 className="text-xl font-display font-semibold text-foreground mb-2">No history yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            Run a scan from the Dashboard to start building your history.
          </p>
          <Link
            href="/"
            className="px-6 py-2.5 rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            Start Scouting
          </Link>
        </div>
      )}
    </div>
  );
}

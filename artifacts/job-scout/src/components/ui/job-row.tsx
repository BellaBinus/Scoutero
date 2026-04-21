import { ExternalLink, MapPin, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobListing, JobStatus } from "@workspace/api-client-react";
import { useUpdateJobStatus } from "@workspace/api-client-react";
import { filterLocationForDisplay, type LocationState } from "@/lib/location-filter";

interface JobRowProps {
  job: JobListing;
  matchedKeywords?: string[];
  locationFilter?: LocationState;
}

function decodeEntities(raw: string): string {
  return raw
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

const STATUS_OPTIONS: { value: JobStatus; label: string; color: string }[] = [
  { value: "new",     label: "New",     color: "text-sky-600 bg-sky-50 border-sky-200" },
  { value: "saved",   label: "Saved",   color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "applied", label: "Applied", color: "text-violet-600 bg-violet-50 border-violet-200" },
  { value: "removed", label: "Remove",  color: "text-red-500 bg-red-50 border-red-200" },
];

const SELECT_STYLE = {
  backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 4px center",
};

export function JobRow({ job, matchedKeywords = [], locationFilter }: JobRowProps) {
  const displayLocation = locationFilter
    ? filterLocationForDisplay(job.location, locationFilter, job.title)
    : job.location;
  const parsedPostedAt = job.postedAt ? new Date(job.postedAt) : null;
  const validPostedAt = parsedPostedAt && !isNaN(parsedPostedAt.getTime()) ? parsedPostedAt : null;
  const postedDate = validPostedAt ?? new Date(job.createdAt);
  const title = decodeEntities(job.title);
  const { mutate: updateStatus, isPending } = useUpdateJobStatus();

  const currentStatus = job.status ?? "new";
  const currentOption = STATUS_OPTIONS.find((o) => o.value === currentStatus) ?? STATUS_OPTIONS[0];

  const statusSelect = (
    <select
      value={currentStatus}
      disabled={isPending}
      onChange={(e) => updateStatus({ id: job.id, status: e.target.value as JobStatus })}
      className={`text-xs font-semibold px-2 py-1 rounded-lg border cursor-pointer transition-colors appearance-none pr-5 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${currentOption.color}`}
      style={SELECT_STYLE}
    >
      {STATUS_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );

  const externalLink = (
    <a
      href={job.url}
      target="_blank"
      rel="noopener noreferrer"
      className="p-1.5 text-card-foreground/40 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
      title="View / Apply"
    >
      <ExternalLink className="w-4 h-4" />
    </a>
  );

  const keywordBadges = matchedKeywords.length > 0 && (
    <div className="flex flex-wrap gap-1">
      {matchedKeywords.map((kw) => (
        <span
          key={kw}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
        >
          {kw}
        </span>
      ))}
    </div>
  );

  return (
    <div className="group relative overflow-hidden bg-card border border-border rounded-2xl hover:bg-primary/5 hover:border-primary/30 transition-colors shadow-sm">
      <div className="absolute left-0 top-0 w-0.5 h-0 bg-primary group-hover:h-full transition-all duration-200 ease-out" />

      {/* ── Mobile layout (hidden on md+) ── */}
      <div className="md:hidden px-4 py-4">
        {/* Row 1: Company + actions */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-xs font-semibold text-card-foreground/60 uppercase tracking-wide truncate min-w-0">
            {job.companyName}
          </span>
          <div className="shrink-0 flex items-center gap-1.5">
            {statusSelect}
            {externalLink}
          </div>
        </div>
        {/* Row 2: Title */}
        <p className="font-display font-semibold text-card-foreground leading-snug mb-1.5">
          {title}
        </p>
        {/* Row 3: Keywords */}
        {keywordBadges && <div className="mb-1.5">{keywordBadges}</div>}
        {/* Row 4: Location (left) + date (right) */}
        <div className="flex items-center justify-between gap-2 text-xs text-card-foreground/50">
          {displayLocation ? (
            <span className="flex items-center gap-1 min-w-0">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{displayLocation}</span>
            </span>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(postedDate, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* ── Desktop layout (hidden on mobile) ── */}
      <div className="hidden md:flex items-start gap-4 px-5 py-4">
        {/* Company + Location */}
        <div className="w-36 shrink-0 pt-0.5">
          <span className="text-sm font-semibold text-card-foreground/80 line-clamp-2 leading-snug block">
            {job.companyName}
          </span>
          {displayLocation && (
            <span className="flex items-center gap-1 text-xs text-card-foreground/50 mt-1">
              <MapPin className="w-3 h-3 shrink-0" />
              <span className="truncate">{displayLocation}</span>
            </span>
          )}
        </div>

        {/* Title + keywords + timestamp */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-display font-semibold text-card-foreground leading-snug line-clamp-2">
              {title}
            </span>
            {keywordBadges}
          </div>
          <span className="flex items-center gap-1 text-xs text-card-foreground/50 mt-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(postedDate, { addSuffix: true })}
          </span>
        </div>

        {/* Status dropdown + link */}
        <div className="shrink-0 flex items-center gap-2 pt-0.5 ml-auto">
          {statusSelect}
          {externalLink}
        </div>
      </div>
    </div>
  );
}

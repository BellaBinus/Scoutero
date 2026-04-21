import { Building2, ExternalLink, MapPin, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { JobListing } from "@workspace/api-client-react";
import { filterLocationForDisplay, type LocationState } from "@/lib/location-filter";

interface JobCardProps {
  job: JobListing;
  matchedKeywords?: string[];
  locationFilter?: LocationState;
}

function cleanDescription(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const decoded = raw
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  const stripped = decoded.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return stripped || null;
}

export function JobCard({ job, matchedKeywords = [], locationFilter }: JobCardProps) {
  const displayLocation = locationFilter
    ? filterLocationForDisplay(job.location, locationFilter, job.title)
    : job.location;
  const parsedPostedAt = job.postedAt ? new Date(job.postedAt) : null;
  const validPostedAt = parsedPostedAt && !isNaN(parsedPostedAt.getTime()) ? parsedPostedAt : null;
  const hasPostedAt = !!validPostedAt;
  const postedDate = validPostedAt ?? new Date(job.createdAt);
  const description = cleanDescription(job.description);

  return (
    <div className="group bg-card rounded-2xl p-5 border border-border/50 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 relative overflow-hidden flex flex-col h-full">
      <div className="absolute top-0 left-0 w-1 h-0 bg-primary group-hover:h-full transition-all duration-300 ease-out" />

      <div className="flex justify-between items-start mb-3 gap-4">
        <div>
          <h3 className="font-display font-semibold text-lg text-card-foreground line-clamp-2 leading-tight">
            {job.title}
          </h3>
          <div className="flex items-center gap-1.5 mt-1.5 text-card-foreground/60">
            <Building2 className="w-4 h-4" />
            <span className="font-medium text-sm text-card-foreground/80">{job.companyName}</span>
          </div>
        </div>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-2 text-card-foreground/50 hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
          title="Apply/View Original"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      {/* Matched keyword badges */}
      {matchedKeywords.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {matchedKeywords.map((kw) => (
            <span
              key={kw}
              className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-primary/10 text-primary border border-primary/20"
            >
              {kw}
            </span>
          ))}
        </div>
      )}

      {description && (
        <p className="text-sm text-card-foreground/70 line-clamp-2 mb-4 flex-grow">
          {description}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4 border-t border-border text-xs text-card-foreground/60 font-medium">
        {displayLocation && (
          <div className="flex items-center gap-1.5 bg-card-foreground/5 px-2.5 py-1 rounded-md">
            <MapPin className="w-3.5 h-3.5" />
            {displayLocation}
          </div>
        )}
        <div className="flex items-center gap-1.5 bg-card-foreground/5 px-2.5 py-1 rounded-md ml-auto">
          <Clock className="w-3.5 h-3.5" />
          {hasPostedAt ? "posted " : "discovered "}{formatDistanceToNow(postedDate, { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}

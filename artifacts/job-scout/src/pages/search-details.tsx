import { useRoute, Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useGetSearch } from "@workspace/api-client-react";
import { JobCard } from "@/components/ui/job-card";

export default function SearchDetailsPage() {
  const [, params] = useRoute("/history/:id");
  const searchId = params?.id ? parseInt(params.id, 10) : 0;
  
  const { data: search, isLoading, error } = useGetSearch(searchId);

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-24 bg-slate-200 rounded mb-8" />
        <div className="h-16 w-3/4 bg-slate-200 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-8">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-slate-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error || !search) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-display font-bold text-white">Search not found</h2>
        <Link href="/history" className="text-primary hover:underline mt-4 inline-block">Back to history</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div>
        <Link href="/history" className="inline-flex items-center gap-2 text-sm font-semibold transition-colors mb-5 px-3 py-1.5 rounded-lg" style={{ color: "#4d7435", background: "rgba(77,116,53,0.08)" }}>
          <ArrowLeft className="w-4 h-4" />
          Back to History
        </Link>
        <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>"{search.keywords}"</h2>
        <p className="text-sm" style={{ color: "#9a8060" }}>
          Scouted on {format(new Date(search.createdAt), "MMMM d, yyyy 'at' h:mm a")} · {search.jobCount} matches found
        </p>
      </div>

      <div className="pt-6 border-t border-border/60">
        {search.jobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {search.jobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-card-foreground/60 font-medium">
            No active listings found for this search criteria.
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { Tag, Plus, Trash2, ArrowRight, Ban, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  useListKeywords,
  useCreateKeyword,
  useDeleteKeyword,
  getListKeywordsQueryKey,
  useGetGlobalSettings,
  useUpdateGlobalSettings,
  useGetUserFrequency,
  useUpdateUserFrequency,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useIsAdmin } from "@/hooks/use-is-admin";

const GREEN_BORDER = "rgba(77,116,53,0.3)";
const PINK_BORDER  = "rgba(196,112,153,0.35)";

export default function KeywordsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { isAdmin } = useIsAdmin();

  const { data: keywords, isLoading } = useListKeywords();
  const createIncludeKeyword = useCreateKeyword();
  const createExcludeKeyword = useCreateKeyword();
  const deleteKeyword = useDeleteKeyword();

  const { data: globalSettings } = useGetGlobalSettings();
  const { data: userFreqData } = useGetUserFrequency();
  const updateGlobal = useUpdateGlobalSettings();
  const updateUserFreq = useUpdateUserFrequency();

  const [includeInput, setIncludeInput] = useState("");
  const [excludeInput, setExcludeInput] = useState("");

  const globalDefault = globalSettings?.defaultMinKeywordFrequency ?? 2;
  const userOverride = userFreqData?.minKeywordFrequency ?? null;
  const effectiveFreq = userOverride ?? globalDefault;

  const [freqInput, setFreqInput] = useState<string>(String(effectiveFreq));
  const [adminFreqInput, setAdminFreqInput] = useState<string>(String(globalDefault));

  useEffect(() => { setFreqInput(String(effectiveFreq)); }, [effectiveFreq]);
  useEffect(() => { setAdminFreqInput(String(globalDefault)); }, [globalDefault]);

  const includeKeywords = (keywords?.filter((k) => k.type !== "exclude") ?? []).sort((a, b) => a.term.localeCompare(b.term));
  const excludeKeywords = (keywords?.filter((k) => k.type === "exclude") ?? []).sort((a, b) => a.term.localeCompare(b.term));

  const handleAdd = async (raw: string, type: "include" | "exclude", clear: () => void) => {
    const terms = raw.split(",").map(t => t.trim()).filter(t => t.length > 0);
    if (terms.length === 0) return;

    const existingTerms = new Set((keywords ?? []).map(k => k.term.toLowerCase()));
    const duplicates = terms.filter(t => existingTerms.has(t.toLowerCase()));
    const toAdd = terms.filter(t => !existingTerms.has(t.toLowerCase()));

    if (duplicates.length > 0) {
      toast({
        title: duplicates.length === 1 ? "Already exists" : "Some already exist",
        description: `${duplicates.map(t => `"${t}"`).join(", ")} ${duplicates.length === 1 ? "is" : "are"} already in your list.`,
      });
    }

    if (toAdd.length === 0) return;

    const mutation = type === "include" ? createIncludeKeyword : createExcludeKeyword;
    const failed: string[] = [];
    let successCount = 0;

    for (const term of toAdd) {
      try {
        await mutation.mutateAsync({ data: { term, type } });
        successCount++;
      } catch {
        failed.push(term);
      }
    }

    queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
    clear();

    if (successCount > 0) {
      const label = type === "include"
        ? (successCount === 1 ? "Keyword added" : `${successCount} keywords added`)
        : (successCount === 1 ? "Exclude term added" : `${successCount} terms added`);
      toast({
        title: label,
        description: successCount === 1
          ? `"${toAdd[0]}" ${type === "include" ? "will be used to match jobs." : "will hide jobs with this in the title."}`
          : `${toAdd.map(t => `"${t}"`).join(", ")} added.`,
      });
    }
    if (failed.length > 0) {
      toast({ title: "Some failed to save", description: failed.join(", "), variant: "destructive" });
    }
  };

  const handleDelete = (id: number, term: string) => {
    deleteKeyword.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListKeywordsQueryKey() });
          toast({ title: "Removed", description: `"${term}" removed.` });
        },
      }
    );
  };

  const handleUserFreqBlur = () => {
    const trimmed = freqInput.trim();
    if (trimmed === "") {
      if (userOverride !== null) {
        updateUserFreq.mutate({ minKeywordFrequency: null }, {
          onSuccess: () => toast({ title: "Reset to default", description: `Using system default (${globalDefault}×).` }),
        });
      }
      setFreqInput(String(globalDefault));
      return;
    }
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 1 || n > 10) { setFreqInput(String(effectiveFreq)); return; }
    if (n === effectiveFreq) return;
    updateUserFreq.mutate(
      { minKeywordFrequency: n },
      {
        onSuccess: () => toast({ title: "Frequency updated", description: `Keywords must appear at least ${n}× to match.` }),
        onError: () => { setFreqInput(String(effectiveFreq)); toast({ title: "Error", description: "Failed to save.", variant: "destructive" }); },
      }
    );
  };

  const handleAdminFreqBlur = () => {
    const trimmed = adminFreqInput.trim();
    if (trimmed === "") { setAdminFreqInput(String(globalDefault)); return; }
    const n = parseInt(trimmed, 10);
    if (isNaN(n) || n < 1 || n > 10) { setAdminFreqInput(String(globalDefault)); return; }
    if (n === globalDefault) return;
    updateGlobal.mutate(
      { defaultMinKeywordFrequency: n },
      {
        onSuccess: () => toast({ title: "Global default updated", description: `New scans require keywords to appear at least ${n}×.` }),
        onError: () => { setAdminFreqInput(String(globalDefault)); toast({ title: "Error", description: "Failed to update.", variant: "destructive" }); },
      }
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h2 className="text-2xl font-display font-bold mb-1" style={{ color: "#4d7435" }}>Keywords</h2>
        <p className="text-sm" style={{ color: "#9a8060" }}>Use keywords to match relevant roles and filter out noise.</p>
      </div>

      {/*
        6-cell interleaved grid — rows 1 & 2 align headers and inputs across columns.
        Row 3 list cells use self-start so each sizes to its own content.
        On mobile (1-col) CSS `order` restores per-card stacking.
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">

        {/* ── GREEN HEADER  (mobile: order 1, desktop: col-1 row-1) ── */}
        <div
          className="order-1 lg:order-1 rounded-t-3xl bg-primary px-6 py-5"
          style={{ border: `2px solid ${GREEN_BORDER}`, borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Tag className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-display font-bold text-white">Search Keywords</h2>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            Jobs matching any of these keywords will appear in your feed.
            <br />
            You can change the frequency setting below.
          </p>
        </div>

        {/* ── PINK HEADER  (mobile: order 4, desktop: col-2 row-1) ── */}
        <div
          className="order-4 lg:order-2 rounded-t-3xl px-6 py-5 mt-6 lg:mt-0"
          style={{ background: "#c47099", border: `2px solid ${PINK_BORDER}`, borderBottom: "1px solid hsl(var(--border))" }}
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
              <Ban className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-display font-bold text-white">Exclude Titles</h2>
          </div>
          <p className="text-sm text-white/80 leading-relaxed">
            Jobs with any of these words in their title will be hidden from all results.
          </p>
        </div>

        {/* ── GREEN INPUT  (mobile: order 2, desktop: col-1 row-2) ── */}
        <div
          className="order-2 lg:order-3 px-6 py-4 bg-muted/30 flex flex-col justify-center"
          style={{ borderLeft: `2px solid ${GREEN_BORDER}`, borderRight: `2px solid ${GREEN_BORDER}`, borderBottom: "1px solid hsl(var(--border))" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd(includeInput, "include", () => setIncludeInput(""));
            }}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={includeInput}
                onChange={(e) => setIncludeInput(e.target.value)}
                placeholder="e.g. AML, fraud, risk analyst (comma to add multiple)…"
                className="flex-[2] min-w-0 px-4 py-2.5 rounded-xl border border-border text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                style={{ background: "#fffef4" }}
              />
              <button
                type="submit"
                disabled={!includeInput.trim() || createIncludeKeyword.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40 shrink-0"
              >
                {createIncludeKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm font-medium" style={{ color: "#4d7435" }}>Frequency</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={freqInput}
                  onChange={(e) => setFreqInput(e.target.value)}
                  onBlur={handleUserFreqBlur}
                  className="w-8 px-1 py-0.5 rounded border border-border text-xs font-semibold text-center text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                  style={{ background: "#fffef4" }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {(() => { const n = parseInt(freqInput, 10) > 0 ? parseInt(freqInput, 10) : effectiveFreq; return `(Any search keyword should appear at least ${n} ${n === 1 ? "time" : "times"} for a job to match)`; })()}
              </p>
            </div>
          </form>
        </div>

        {/* ── PINK INPUT  (mobile: order 5, desktop: col-2 row-2) ── */}
        <div
          className="order-5 lg:order-4 px-6 py-4 flex flex-col justify-start"
          style={{ background: "rgba(196,112,153,0.04)", borderLeft: `2px solid ${PINK_BORDER}`, borderRight: `2px solid ${PINK_BORDER}`, borderBottom: "1px solid hsl(var(--border))" }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAdd(excludeInput, "exclude", () => setExcludeInput(""));
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={excludeInput}
              onChange={(e) => setExcludeInput(e.target.value)}
              placeholder="e.g. Senior, Manager, Intern (comma-separated)…"
              className="flex-[2] min-w-0 px-4 py-2.5 rounded-xl border text-sm text-card-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 transition-all"
              style={{ background: "#fffef4", borderColor: PINK_BORDER, outlineColor: "#c47099" }}
            />
            <button
              type="submit"
              disabled={!excludeInput.trim() || createExcludeKeyword.isPending}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-white text-sm font-semibold hover:opacity-80 transition-opacity disabled:opacity-40 shrink-0"
              style={{ background: "#c47099" }}
            >
              {createExcludeKeyword.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </form>
        </div>

        {/* ── GREEN LIST  (mobile: order 3, desktop: col-1 row-3) — self-start so height is content-driven ── */}
        <div
          className="order-3 lg:order-5 self-start rounded-b-3xl bg-card"
          style={{ borderLeft: `2px solid ${GREEN_BORDER}`, borderRight: `2px solid ${GREEN_BORDER}`, borderBottom: `2px solid ${GREEN_BORDER}` }}
        >
          <div className="px-6 py-4 space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : includeKeywords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Tag className="w-8 h-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">No search keywords yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add terms above to start matching jobs.</p>
              </div>
            ) : (
              <AnimatePresence>
                {includeKeywords.map((kw) => (
                  <motion.div
                    key={kw.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="group flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Tag className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span className="text-sm font-medium text-card-foreground truncate">{kw.term}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={() => navigate(`/?keywords=${encodeURIComponent(kw.term)}`)}
                        title="Search with this keyword"
                        className="p-1.5 text-primary/50 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(kw.id, kw.term)}
                        title="Remove"
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
          <div className="px-6 pb-4 space-y-1.5">
            {!isLoading && includeKeywords.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {includeKeywords.length} keyword{includeKeywords.length !== 1 ? "s" : ""} · Jobs must match at least one to appear
              </p>
            )}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Global default frequency:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={adminFreqInput}
                  onChange={(e) => setAdminFreqInput(e.target.value)}
                  onBlur={handleAdminFreqBlur}
                  className="w-8 px-1 py-0.5 rounded border border-border text-xs font-semibold text-center text-card-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:border-primary transition-all"
                  style={{ background: "#fffef4" }}
                />
                {updateGlobal.isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              </div>
            )}
          </div>
        </div>

        {/* ── PINK LIST  (mobile: order 6, desktop: col-2 row-3) — self-start so height is content-driven ── */}
        <div
          className="order-6 lg:order-6 self-start rounded-b-3xl bg-card"
          style={{ borderLeft: `2px solid ${PINK_BORDER}`, borderRight: `2px solid ${PINK_BORDER}`, borderBottom: `2px solid ${PINK_BORDER}` }}
        >
          <div className="px-6 py-4 space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-10 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : excludeKeywords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Ban className="w-8 h-8 mb-2" style={{ color: "rgba(196,112,153,0.3)" }} />
                <p className="text-sm text-muted-foreground">No title exclusions yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add words above to hide unwanted job titles.</p>
              </div>
            ) : (
              <AnimatePresence>
                {excludeKeywords.map((kw) => (
                  <motion.div
                    key={kw.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="group flex items-center justify-between px-4 py-2.5 rounded-xl border transition-colors"
                    style={{ background: "rgba(196,112,153,0.06)", borderColor: "rgba(196,112,153,0.25)" }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Ban className="w-3.5 h-3.5 shrink-0" style={{ color: "#c47099" }} />
                      <span className="text-sm font-medium truncate" style={{ color: "#8a3a62" }}>{kw.term}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(kw.id, kw.term)}
                      title="Remove"
                      className="p-1.5 rounded-lg transition-colors opacity-0 group-hover:opacity-100 ml-2 shrink-0 hover:opacity-70"
                      style={{ color: "rgba(196,112,153,0.6)" }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
          {!isLoading && excludeKeywords.length > 0 && (
            <div className="px-6 pb-4">
              <p className="text-xs" style={{ color: "rgba(196,112,153,0.7)" }}>
                {excludeKeywords.length} exclusion{excludeKeywords.length !== 1 ? "s" : ""} active · Applied to scans and your current job list
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

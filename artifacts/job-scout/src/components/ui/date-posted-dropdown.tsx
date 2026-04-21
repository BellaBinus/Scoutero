import { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type DatePostedFilter = "all" | "24h" | "3d" | "7d" | "30d";

const OPTIONS: { value: DatePostedFilter; label: string }[] = [
  { value: "all", label: "All Dates" },
  { value: "24h", label: "Past 24 hours" },
  { value: "3d",  label: "Past 3 days" },
  { value: "7d",  label: "Past week" },
  { value: "30d", label: "Past month" },
];

export function labelForFilter(f: DatePostedFilter): string {
  return OPTIONS.find((o) => o.value === f)?.label ?? "All Dates";
}

export function cutoffForFilter(f: DatePostedFilter): Date | null {
  if (f === "all") return null;
  const ms = { "24h": 24, "3d": 72, "7d": 168, "30d": 720 }[f] * 60 * 60 * 1000;
  return new Date(Date.now() - ms);
}

interface DatePostedDropdownProps {
  value: DatePostedFilter;
  onChange: (v: DatePostedFilter) => void;
}

export function DatePostedDropdown({ value, onChange }: DatePostedDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "#fffef4" }}
        className={cn(
          "flex items-center gap-2 px-4 h-10 rounded-xl border text-card-foreground text-sm font-medium transition-all",
          "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
          open ? "border-primary/40 ring-2 ring-primary/20" : "border-border"
        )}
      >
        <CalendarDays className="w-4 h-4 text-card-foreground/50 shrink-0" />
        <span className="whitespace-nowrap">{labelForFilter(value)}</span>
        <ChevronDown className={cn("w-4 h-4 text-card-foreground/40 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 w-44 border border-border rounded-xl shadow-xl z-50 overflow-hidden" style={{ background: "#fffef4" }}
          >
            <div className="p-1">
              {OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm text-card-foreground hover:bg-primary/5 transition-colors"
                >
                  {opt.label}
                  {value === opt.value && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useRef, useEffect, useMemo } from "react";
import { MapPin, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type LocationState, CITY_COORDS, locationLabel } from "@/lib/location-filter";
import { cn } from "@/lib/utils";

interface LocationDropdownProps {
  value: LocationState;
  onChange: (v: LocationState) => void;
}

export function LocationDropdown({ value, onChange }: LocationDropdownProps) {
  const [open, setOpen] = useState(false);
  const [cityFocused, setCityFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const citySuggestions = useMemo(() => {
    const q = value.city.toLowerCase().trim();
    if (!q) return [];
    return Object.keys(CITY_COORDS)
      .filter((city) => city.includes(q))
      .sort((a, b) => (a.startsWith(q) ? -1 : b.startsWith(q) ? 1 : a.localeCompare(b)))
      .slice(0, 6)
      .map((city) => city.replace(/\b\w/g, (c) => c.toUpperCase()));
  }, [value.city]);

  const hasFilter = value.usRemote || value.usLocal;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "#fffef4" }}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl border text-card-foreground text-sm font-medium transition-all",
          "hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20",
          open ? "border-primary/40 ring-2 ring-primary/20" : "border-border"
        )}
      >
        <MapPin className="w-4 h-4 text-card-foreground/50 shrink-0" />
        <span className="whitespace-nowrap">{locationLabel(value)}</span>
        <ChevronDown className={cn("w-4 h-4 text-card-foreground/40 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full mt-1.5 w-72 border border-border rounded-xl shadow-xl z-50 overflow-hidden" style={{ background: "#fffef4" }}
          >
            <div className="p-1">
              {/* US Remote */}
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.usRemote}
                  onChange={(e) => onChange({ ...value, usRemote: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <div>
                  <p className="text-sm text-card-foreground">US remote jobs</p>
                  <p className="text-xs text-muted-foreground">No specific city or state listed</p>
                </div>
              </label>

              {/* US Local */}
              <label className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-primary/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={value.usLocal}
                  onChange={(e) => onChange({ ...value, usLocal: e.target.checked })}
                  className="w-4 h-4 rounded accent-primary cursor-pointer"
                />
                <div>
                  <p className="text-sm text-card-foreground">US local jobs</p>
                  <p className="text-xs text-muted-foreground">Jobs near a specific city</p>
                </div>
              </label>

              {/* City + radius */}
              <div className={cn("px-3 py-2.5 transition-opacity", value.usLocal ? "opacity-100" : "opacity-40 pointer-events-none")}>
                <p className="text-sm text-card-foreground mb-2">Enter city</p>
                {value.usLocal && !value.city.trim() && (
                  <p className="text-xs mb-2 px-2 py-1.5 rounded-lg" style={{ color: "#92600a", background: "#fef3c7" }}>
                    ⚠ Enter a city for local job search
                  </p>
                )}
                <div className="relative mb-2">
                  <input
                    type="text"
                    placeholder="e.g. San Francisco, Austin…"
                    value={value.city}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange({ ...value, city: e.target.value })}
                    onFocus={() => setCityFocused(true)}
                    onBlur={() => setTimeout(() => setCityFocused(false), 120)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors" style={{ background: "#fffef4", color: "#2a1f0e" }}
                  />
                  {cityFocused && citySuggestions.length > 0 && (
                    <ul className="absolute left-0 right-0 top-full mt-1 border border-border rounded-lg shadow-md z-10 overflow-hidden" style={{ background: "#fffef4" }}>
                      {citySuggestions.map((s) => (
                        <li
                          key={s}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            onChange({ ...value, city: s });
                            setCityFocused(false);
                          }}
                          className="px-2.5 py-1.5 text-xs hover:bg-muted cursor-pointer" style={{ color: "#2a1f0e" }}
                        >
                          {s}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">Radius</span>
                  <input
                    type="range"
                    min={5} max={150} step={5}
                    value={value.radiusMiles}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onChange({ ...value, radiusMiles: Number(e.target.value) })}
                    className="flex-1 accent-primary"
                  />
                  <span className="text-xs font-medium w-14 text-right whitespace-nowrap" style={{ color: "#2a1f0e" }}>
                    {value.radiusMiles} mi
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

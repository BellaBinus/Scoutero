import { ReactNode, useMemo, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Search, Building2, History, Tag, Briefcase, LogOut, MapPin, Clock, ActivitySquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useUser, useClerk } from "@clerk/react";
import { useDevRole } from "@/contexts/dev-role-context";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useIsMobile } from "@/hooks/use-mobile";
import { useListJobs, useListKeywords, useListSearches } from "@workspace/api-client-react";
import { loadLocationState, locationLabel, matchesLocation, type LocationState } from "@/lib/location-filter";

const SANDSTONE = "#e4cd99";
const MOSS = "#4d7435";
const ORCHID = "#f39cc7";
const CANVAS = "#fffef4";
const BORDER = "#cdb87e";

interface AppLayoutProps {
  children: ReactNode;
}

function formatLastScan(iso: string): string {
  const date = new Date(iso);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${yy} ${hh}:${min}`;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { simulateRegularUser, setSimulateRegularUser } = useDevRole();
  const { isAdmin } = useIsAdmin();
  const isMobile = useIsMobile();

  const { data: allJobs } = useListJobs();
  const { data: keywords } = useListKeywords();
  const { data: searches } = useListSearches();

  const [locationState, setLocationState] = useState<LocationState>(loadLocationState);

  useEffect(() => {
    function handleLocationChanged(e: Event) {
      setLocationState((e as CustomEvent).detail);
    }
    window.addEventListener("jobscout:location-changed", handleLocationChanged);
    return () => window.removeEventListener("jobscout:location-changed", handleLocationChanged);
  }, []);

  const targetLocation = locationLabel(locationState) || "All Locations";

  const lastScan = searches && searches.length > 0
    ? [...searches].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
    : null;

  const newJobsCount = useMemo(() => {
    if (!allJobs || !keywords) return 0;
    const excludeTerms = keywords.filter(k => k.type === "exclude").map(k => k.term.toLowerCase());
    const includeTerms = keywords.filter(k => k.type !== "exclude").map(k => k.term.toLowerCase());
    const statusPriority: Record<string, number> = { applied: 0, saved: 1, new: 2 };
    const parseKws = (raw: string | null | undefined): string[] => {
      try { return raw ? JSON.parse(raw) : []; } catch { return []; }
    };
    const candidates = allJobs.filter(j => {
      if (j.status === "removed") return false;
      if (!matchesLocation(j.location ?? "", locationState, j.title, j.requireCityMatch)) return false;
      if (excludeTerms.length > 0 && excludeTerms.some(t => j.title.toLowerCase().includes(t))) return false;
      if (includeTerms.length > 0) {
        const matched = parseKws(j.matchedKeywords).map(k => k.toLowerCase());
        if (!includeTerms.some(t => matched.includes(t))) return false;
      }
      return true;
    });
    const seen = new Map<string, typeof candidates[number]>();
    for (const j of candidates) {
      const key = `${j.companyName}|||${j.title}`;
      const existing = seen.get(key);
      if (!existing) { seen.set(key, j); continue; }
      const ep = statusPriority[existing.status ?? "new"] ?? 2;
      const np = statusPriority[j.status ?? "new"] ?? 2;
      if (np < ep || (np === ep && j.id > existing.id)) seen.set(key, j);
    }
    return Array.from(seen.values()).filter(j => j.status === "new").length;
  }, [allJobs, keywords, locationState]);

  const navItems = [
    { name: "Scout HQ", href: "/", icon: Search },
    { name: "Jobs", href: "/jobs", icon: Briefcase },
    { name: "Keywords", href: "/keywords", icon: Tag },
    ...(isAdmin ? [{ name: "Companies", href: "/companies", icon: Building2 }] : []),
    { name: "History", href: "/history", icon: History },
    ...(isAdmin ? [{ name: "Ops Log", href: "/ops-log", icon: ActivitySquare }] : []),
  ];

  const displayName = user?.firstName
    ? `${user.firstName}${user.lastName ? " " + user.lastName : ""}`
    : user?.emailAddresses?.[0]?.emailAddress ?? "User";

  if (isMobile) {
    return (
      <div
        style={{
          background: CANVAS,
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {import.meta.env.DEV && simulateRegularUser && (
          <div className="bg-yellow-400/90 text-yellow-900 text-xs font-semibold text-center py-1 px-3 z-[60] shrink-0">
            Previewing as regular user —{" "}
            <button onClick={() => setSimulateRegularUser(false)} className="underline hover:no-underline">
              switch back to Admin
            </button>
          </div>
        )}

        {/* Mobile header — logo + user */}
        <header
          style={{
            background: SANDSTONE,
            borderBottom: `1.5px solid ${BORDER}`,
            boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
            height: 52,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            flexShrink: 0,
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-xl shrink-0"
              style={{ width: 28, height: 28, background: MOSS }}
            >
              <span style={{ fontSize: 17, lineHeight: 1, filter: "drop-shadow(0 0 4px rgba(255,255,255,1))" }}>🐒</span>
            </div>
            <span style={{ fontSize: 19, fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: MOSS, letterSpacing: "-0.02em" }}>
              Scoutero
            </span>
            {isAdmin && (
              <span
                className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                style={{ background: "#fde8f3", color: "#b55a8a", border: `1px solid ${ORCHID}` }}
              >
                Admin
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs truncate max-w-[100px]" style={{ color: "#7a6030" }}>{displayName}</span>
            <button
              onClick={() => signOut()}
              title="Sign out"
              className="flex items-center p-1.5 rounded-lg hover:bg-black/10"
              style={{ color: "#7a6030" }}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Main scrollable content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          <main className="px-4 py-5 max-w-2xl mx-auto">
            <motion.div
              key={location}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </main>
        </div>

        {/* Bottom navigation bar */}
        <nav
          style={{
            background: SANDSTONE,
            borderTop: `1.5px solid ${BORDER}`,
            boxShadow: "0 -2px 6px rgba(0,0,0,0.10)",
            display: "flex",
            flexShrink: 0,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors relative"
                style={{ color: isActive ? MOSS : "#9a8060", minWidth: 0 }}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <span className="text-[10px] font-semibold truncate w-full text-center px-0.5">
                  {item.name}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="mobile-active-tab"
                    className="absolute top-0 left-2 right-2 rounded-b-full"
                    style={{ height: 2, background: MOSS }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    );
  }

  return (
    <div
      className="[grid-template-columns:220px_1fr] xl:[grid-template-columns:260px_1fr] 2xl:[grid-template-columns:300px_1fr]"
      style={{
        background: CANVAS,
        height: "100vh",
        display: "grid",
        gridTemplateRows: "auto 1fr",
        overflow: "hidden",
      }}
    >
      {/* ── Top section: dev banner (optional) + ribbon, treated as one grid row ── */}
      <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column" }}>
        {import.meta.env.DEV && simulateRegularUser && (
          <div
            className="bg-yellow-400/90 text-yellow-900 text-xs font-semibold text-center py-1 px-3 z-[60]"
          >
            Previewing as regular user —{" "}
            <button
              onClick={() => setSimulateRegularUser(false)}
              className="underline hover:no-underline"
            >
              switch back to Admin
            </button>
          </div>
        )}

      {/* ── Full-width ribbon: logo | tabs (centered) | user ── */}
      <header
        style={{
          background: SANDSTONE,
          borderBottom: `1.5px solid ${BORDER}`,
          boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
          height: 60,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        {/* Logo + name — matches sidebar width at each breakpoint */}
        <div className="flex items-center shrink-0 w-[220px] xl:w-[260px] 2xl:w-[300px]" style={{ padding: "0 16px", gap: 10 }}>
          <div
            className="flex items-center justify-center rounded-xl shrink-0"
            style={{ width: 32, height: 32, background: MOSS }}
          >
            <span style={{ fontSize: 20, lineHeight: 1, filter: "drop-shadow(0 0 4px rgba(255,255,255,1)) drop-shadow(0 0 2px rgba(255,255,255,0.9))" }}>🐒</span>
          </div>
          <span style={{ fontSize: 21, fontWeight: 700, fontFamily: "'Outfit', sans-serif", color: MOSS, letterSpacing: "-0.02em" }}>
            Scoutero
          </span>
        </div>

        {/* Nav tabs — centered in remaining space */}
        <nav className="flex items-center justify-center flex-1" style={{ height: 60 }}>
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className="relative flex items-center gap-1.5 px-3.5 text-sm font-semibold transition-colors"
                style={{
                  height: 60,
                  color: isActive ? MOSS : "#7a6030",
                }}
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                {item.name}
                {isActive && (
                  <motion.div
                    layoutId="active-tab"
                    className="absolute bottom-0 left-0 right-0 rounded-t-full"
                    style={{ height: 2, background: MOSS }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User info + logout — right side */}
        <div className="flex items-center gap-2 shrink-0" style={{ padding: "0 20px" }}>
          {isAdmin && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: "#fde8f3", color: "#b55a8a", border: `1px solid ${ORCHID}` }}
            >
              Admin
            </span>
          )}
          {import.meta.env.DEV && isAdmin && (
            <button
              onClick={() => setSimulateRegularUser(!simulateRegularUser)}
              title={simulateRegularUser ? "Currently previewing as regular user" : "Preview as regular user"}
              className={cn(
                "text-xs font-semibold px-2 py-0.5 rounded-full border transition-colors",
                simulateRegularUser
                  ? "bg-yellow-100 text-yellow-700 border-yellow-300"
                  : "border-[#cdb87e] hover:bg-white/40"
              )}
              style={{ color: "#5a4020" }}
            >
              {simulateRegularUser ? "user view" : "preview as user"}
            </button>
          )}
          <span className="text-sm" style={{ color: "#7a6030" }}>{displayName}</span>
          <button
            onClick={() => signOut()}
            title="Sign out"
            className="flex items-center gap-1 transition-colors p-1.5 rounded-lg hover:bg-black/10"
            style={{ color: "#7a6030" }}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>
      </div>{/* end top-section wrapper */}

      {/* ── Sidebar — stat cards ── */}
      <aside
        style={{
          background: "#ede0b8",
          borderRight: `1.5px solid ${BORDER}`,
          padding: "24px 16px 20px",
          overflowY: "auto",
        }}
        className="flex flex-col"
      >
        {/* Section label + stat cards grouped together, centred as a unit */}
        <div className="flex flex-col justify-center flex-1">
        <p
          className="text-xs font-semibold tracking-widest uppercase px-1"
          style={{ color: "#9a8060", marginBottom: 20 }}
        >
          Activity Overview
        </p>

        {/* Stat cards */}
        <div className="flex flex-col gap-3">
          {[
            { icon: Briefcase, label: "New Jobs",        value: String(newJobsCount), href: "/jobs", pulse: false },
            { icon: MapPin,    label: "Target Location", value: targetLocation,                      pulse: false },
            { icon: Clock,     label: "Last Scan",       value: lastScan ? formatLastScan(lastScan) : "Never", pulse: true },
          ].map(({ icon: Icon, label, value, href, pulse }) => {
            const card = (
              <div
                key={label}
                className="p-3.5 rounded-xl"
                style={{
                  background: "rgba(255,254,244,0.55)",
                  border: "1px solid rgba(255,255,255,0.7)",
                }}
              >
                <div
                  className="text-xs font-medium mb-1 flex items-center gap-1.5"
                  style={{ color: "#7a6030" }}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </div>
                <div className="text-sm font-semibold leading-tight flex items-center gap-1.5" style={{ color: MOSS }}>
                  {value}
                  {pulse && (
                    <span
                      className="w-1.5 h-1.5 rounded-full animate-pulse shrink-0"
                      style={{ background: ORCHID }}
                    />
                  )}
                </div>
              </div>
            );
            return href ? (
              <Link key={label} href={href}>{card}</Link>
            ) : (
              <div key={label}>{card}</div>
            );
          })}
        </div>
        </div>

        {/* Copyright */}
        <p className="text-xs px-1 mt-6 pt-3" style={{ color: "#b8a070", borderTop: `1px solid ${BORDER}` }}>
          © 2026 Scoutero. All rights reserved.
        </p>
      </aside>

      {/* ── Main content ── */}
      <div style={{ overflowY: "auto" }}>
        <main className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-8 lg:px-10 xl:px-12 py-8">
          <motion.div
            key={location}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}

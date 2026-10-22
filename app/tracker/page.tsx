"use client";

/**
 * /app/tracker/page.tsx
 *
 * Fixes in this version:
 *  - "Use Your Location" / map-click no longer get their coordinates
 *    silently overwritten by the state/LGA auto-focus effects (root cause
 *    of "doesn't move the marker or change filter results").
 *  - Reverse-geocode + geolocation calls are now wrapped in try/catch/finally
 *    so a failed lookup can't leave "Locating…" stuck forever or swallow the
 *    click/location entirely.
 *  - Added a date filter (Year + Month).
 *  - `theme` now actually drives the whole UI, not just the map tiles.
 */

import dynamic from "next/dynamic";
import { useState, useMemo, useEffect, useCallback, useRef, useSyncExternalStore } from "react";
import { getServerThemeSnapshot, getThemeSnapshot, setThemePreference, subscribeTheme } from "../lib/theme";
import { useRouter, useSearchParams } from "next/navigation";
import { getNigeriaGeoData, NigeriaGeoData } from "../lib/nigeria-geo";
import { reverseGeocode } from "../../mapbox-geocode";

const LiveTrackerMap = dynamic(() => import("../components/LiveTrackerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-zinc-900 flex items-center justify-center">
      <span className="text-zinc-500 text-sm animate-pulse">
        Initialising map…
      </span>
    </div>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConflictEvent {
  state: string;
  lga: string;
  month: string;
  year: number;
  incidentCount: number;
  reportedCasualties: number;
  alertType: string;
  eventType?: string;
  subEventType?: string;
  eventDate?: string;
  eventId?: string;
  description?: string;
  coordinates: [number, number];
}

type LoadState = "idle" | "loading" | "ready" | "error";

const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrackerPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [geoData, setGeoData] = useState<NigeriaGeoData | null>(null);
  const [geoDataError, setGeoDataError] = useState(false);
  useEffect(() => {
    let active = true;
    getNigeriaGeoData()
      .then((data) => { if (active) setGeoData(data); })
      .catch((error) => { console.error("Failed to load Nigeria Geo API data:", error); if (active) setGeoDataError(true); });
    return () => { active = false; };
  }, []);
  const statesList = useMemo(() => geoData?.states ?? [], [geoData]);

  const [selectedStateCode, setSelectedStateCode] = useState<string>(
    searchParams.get("stateCode") || "",
  );
  const [selectedLga, setSelectedLga] = useState<string>(
    searchParams.get("lga") || "",
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    searchParams.get("year") || "",
  );
  const [selectedMonth, setSelectedMonth] = useState<string>(
    searchParams.get("month") || "",
  );
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get("category") || "__acled_all__",
  );
  const [selectedSubEventType, setSelectedSubEventType] = useState(
    searchParams.get("subEventType") || "",
  );
  const [visibleMapBounds, setVisibleMapBounds] = useState<[number, number, number, number] | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const selectedState = statesList.find((state) => state.isoCode === selectedStateCode);
  const lgasList = useMemo(() => {
    if (!selectedState || !geoData) return [];
    return (geoData.lgasByState[selectedState.sourceName] ?? []).map((name) => ({ name }));
  }, [geoData, selectedState]);

  // ── Data — fetched once ───────────────────────────────────────────────────
  const [allEvents, setAllEvents] = useState<ConflictEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    setLoadState("loading");

    fetch("/api/conflicts?startYear=2021")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ConflictEvent[]) => {
        setAllEvents(data);
        setLoadState("ready");
      })
      .catch(() => setLoadState("error"));
  }, []);

  // ── Date filter option lists — derived from whatever is actually in the data
  const yearsList = useMemo(() => {
    const years = Array.from(new Set(allEvents.map((ev) => ev.year)));
    return years.sort((a, b) => b - a);
  }, [allEvents]);

  const monthsList = useMemo(() => {
    const months = new Set(allEvents.map((ev) => ev.month));
    return MONTH_ORDER.filter((m) => months.has(m));
  }, [allEvents]);

  const categoriesList = useMemo(() => {
    return Array.from(new Set(allEvents.map((ev) => ev.eventType || ev.alertType)))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [allEvents]);

  const subEventTypeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of allEvents) {
      if (event.subEventType) counts.set(event.subEventType, (counts.get(event.subEventType) ?? 0) + event.incidentCount);
    }
    return counts;
  }, [allEvents]);
  const subEventTypesList = useMemo(() => Array.from(subEventTypeCounts.keys()).sort((a, b) => a.localeCompare(b)), [subEventTypeCounts]);

  // ── Client-side filtering ─────────────────────────────────────────────────
  const controlFilteredEvents = useMemo(() => {
    if (!allEvents.length) return [];

    return allEvents.filter((ev) => {
      if (selectedCategory !== "__acled_all__" && (ev.eventType || ev.alertType) !== selectedCategory) return false;
      if (selectedSubEventType && ev.subEventType !== selectedSubEventType) return false;
      if (selectedStateCode) {
        const stateObj = statesList.find(
          (s) => s.isoCode === selectedStateCode,
        );
        if (stateObj) {
          const target = stateObj.name.replace(/\s*State$/i, "").toLowerCase();
          const evState = ev.state.toLowerCase().trim();
          if (!evState.includes(target) && !target.includes(evState))
            return false;
        }
      }

      if (selectedLga) {
        const norm = (s: string) =>
          s.toLowerCase().replace(/[-\s]/g, "").replace(/ss/g, "s");
        if (
          !norm(ev.lga).includes(norm(selectedLga)) &&
          !norm(selectedLga).includes(norm(ev.lga))
        )
          return false;
      }

      if (selectedYear && String(ev.year) !== selectedYear) return false;
      if (selectedMonth && ev.month !== selectedMonth) return false;

      return true;
    });
  }, [
    allEvents,
    selectedStateCode,
    selectedLga,
    selectedYear,
    selectedMonth,
    selectedCategory,
    selectedSubEventType,
    statesList,
  ]);

  const filteredEvents = useMemo(() => {
    return controlFilteredEvents.filter((ev) => {
      if (!visibleMapBounds) return true;
      const [south, west, north, east] = visibleMapBounds;
      const [latitude, longitude] = ev.coordinates;
      return latitude >= south && latitude <= north && longitude >= west && longitude <= east;
    });
  }, [controlFilteredEvents, visibleMapBounds]);

  // ── Map focus ─────────────────────────────────────────────────────────────
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<ConflictEvent | null>(null);

  // ── Reverse geocode → update dropdowns ───────────────────────────────────
  const [geoLoading, setGeoLoading] = useState(false);

  const applyReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      // Show the point immediately — this is the actual coordinate the user
      // clicked or was located at, and it must win regardless of whether the
      // geocode lookup below succeeds, fails, or matches a dropdown entry.
      setMapFocus([lat, lng]);

      try {
        // Mapbox reverse geocode — replaces Nominatim
        const result = await reverseGeocode(lat, lng);
        if (!result) return;

        // Bidirectional, normalised matching. The previous version only
        // checked `shortStateName.includes(result.state)`, which fails
        // whenever Mapbox returns the fuller form (e.g. "Rivers State")
        // since the short trimmed name can never contain the longer string
        // — that one-way check is why State/LGA silently never updated.
        const normalize = (s: string | undefined | null) =>
          (s ?? "")
            .toLowerCase()
            .replace(/\s*state$/i, "")
            .replace(/[-\s]/g, "")
            .replace(/ss/g, "s")
            .trim();

        const geoData = await getNigeriaGeoData();
        const resultState = normalize(result.state);
        const matchedState = resultState
          ? geoData.states.find((s) => {
              const target = normalize(s.name);
              return target.includes(resultState) || resultState.includes(target);
            })
          : undefined;

        if (matchedState) {
          setSelectedStateCode(matchedState.isoCode);

          const resultLga = normalize(result.lga);
          if (resultLga) {
            const lgas = geoData.lgasByState[matchedState.sourceName] ?? [];
            const matchedLga = lgas.find((name) => {
              const target = normalize(name);
              return target.includes(resultLga) || resultLga.includes(target);
            });
            setSelectedLga(matchedLga ?? "");
          } else {
            setSelectedLga("");
          }
        } else {
          console.warn(
            "Reverse geocode returned a state that didn't match any Nigerian state:",
            result.state,
          );
        }
      } catch (err) {
        console.error("Reverse geocode failed:", err);
      }
    },
    [],
  );

  // Map click handler (passed down to LiveTrackerMap)
  const handleMapLocationSelect = useCallback(
    (lat: number, lng: number) => applyReverseGeocode(lat, lng),
    [applyReverseGeocode],
  );

  // ── Use Your Location ─────────────────────────────────────────────────────
  const handleUseLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          await applyReverseGeocode(coords.latitude, coords.longitude);
        } catch (err) {
          console.error("Use Your Location failed:", err);
        } finally {
          setGeoLoading(false);
        }
      },
      () => setGeoLoading(false),
      { timeout: 8000 },
    );
  }, [applyReverseGeocode]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const isDark = theme === "dark";

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setThemePreference(nextTheme);
    const params = new URLSearchParams(searchParams.toString());
    params.set("theme", nextTheme);
    router.replace(`/tracker?${params.toString()}`);
  };

  // ── Derived display values ────────────────────────────────────────────────
  const selectedStateName =
    statesList
      .find((s) => s.isoCode === selectedStateCode)
      ?.name.replace(/\s*State$/i, "") || "";

  const totalCasualties = filteredEvents.reduce(
    (sum, ev) => sum + ev.reportedCasualties,
    0,
  );

  const hasActiveFilters =
    selectedCategory !== "__acled_all__" || selectedSubEventType || selectedStateCode || selectedLga || selectedYear || selectedMonth;

  const clearAllFilters = () => {
    setSelectedStateCode("");
    setSelectedLga("");
    setSelectedYear("");
    setSelectedMonth("");
    setSelectedCategory("__acled_all__");
    setSelectedSubEventType("");
    setVisibleMapBounds(null);
    setMapFocus(null);
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className={`h-screen w-full flex flex-col overflow-hidden ${
        isDark ? "bg-zinc-950" : "bg-zinc-50"
      }`}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header
        className={`flex-none flex items-center justify-between px-4 py-2.5 border-b z-10 ${
          isDark ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`text-xs font-bold tracking-wide ${
              isDark ? "text-zinc-100" : "text-zinc-900"
            }`}
          >
            NigeriaWatch · Live Tracker
          </span>
        </div>
        <div className="flex items-center gap-2">
        <button
          type="button"
          className="md:hidden text-[10px] font-medium px-2.5 py-1 rounded-lg border border-emerald-700 text-emerald-700 dark:text-emerald-300 dark:border-emerald-800"
          aria-expanded={isMobileSidebarOpen}
          onClick={() => setIsMobileSidebarOpen((open) => !open)}
        >
          {isMobileSidebarOpen ? "Hide filters" : "Filters"}
        </button>
        <button
          onClick={toggleTheme}
          className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
            isDark
              ? "text-zinc-400 hover:text-zinc-200 bg-zinc-900 border-zinc-800"
              : "text-zinc-600 hover:text-zinc-900 bg-zinc-100 border-zinc-300"
          }`}
        >
          {isDark ? "☀ Light" : "◑ Dark"}
        </button>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside
          className={`${isMobileSidebarOpen ? "flex max-h-[45%] md:max-h-none" : "hidden md:flex"} w-full md:w-72 md:flex-none flex-col overflow-y-auto border-b md:border-b-0 md:border-r ${
            isDark ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200"
          }`}
        >
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">
                Filter Location
              </p>
              <p
                className={`text-[11px] ${
                  isDark ? "text-zinc-500" : "text-zinc-500"
                }`}
              >
                Dropdowns and map stay in sync automatically.
              </p>
            </div>

            {/* Use Your Location */}
            <button
              onClick={handleUseLocation}
              disabled={geoLoading}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDark
                  ? "bg-zinc-900 hover:bg-zinc-800 border-zinc-700 hover:border-emerald-700 text-zinc-200"
                  : "bg-zinc-100 hover:bg-zinc-200 border-zinc-300 hover:border-emerald-600 text-zinc-800"
              }`}
            >
              {geoLoading ? (
                <>
                  <span className="h-3 w-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  Locating…
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-3.5 w-3.5 text-emerald-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
                  </svg>
                  Use Your Location
                </>
              )}
            </button>

            {/* State dropdown */}
            <div className="flex flex-col gap-1.5">
              <label
                className={`text-[11px] font-medium ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                State
              </label>
              <div className="relative">
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    setSelectedLga("");
                    setMapFocus(null);
                  }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer appearance-none focus:outline-none focus:border-emerald-600 ${
                    isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                      : "bg-white border-zinc-300 text-zinc-800"
                  }`}
                >
                  <option value="">{geoData ? "All States" : geoDataError ? "States unavailable" : "Loading states…"}</option>
                  {statesList.map((s) => (
                    <option key={s.isoCode} value={s.isoCode}>
                      {s.name.replace(/\s*State$/i, "")}
                    </option>
                  ))}
                </select>
                <span
                  className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  ▼
                </span>
              </div>
              {geoDataError && <p className="mt-1 text-[10px] text-red-500" role="status">Location lists could not be loaded. Refresh to try again.</p>}
            </div>

            {/* LGA dropdown */}
            <div className="flex flex-col gap-1.5">
              <label
                className={`text-[11px] font-medium ${
                  isDark ? "text-zinc-400" : "text-zinc-500"
                }`}
              >
                Local Govt. Area
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedStateCode}
                  onChange={(e) => { setSelectedLga(e.target.value); setMapFocus(null); }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer appearance-none disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-600 ${
                    isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                      : "bg-white border-zinc-300 text-zinc-800"
                  }`}
                >
                  <option value="">All LGAs</option>
                  {lgasList.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span
                  className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] ${
                    isDark ? "text-zinc-500" : "text-zinc-400"
                  }`}
                >
                  ▼
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className={`text-[11px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>Conflict category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium appearance-none focus:outline-none focus:border-emerald-600 ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-300 text-zinc-800"}`}
              >
                <option value="__acled_all__">All conflict records</option>
                {categoriesList.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className={`text-[11px] font-medium ${isDark ? "text-zinc-400" : "text-zinc-500"}`}>ACLED event subtype</label>
              <select value={selectedSubEventType} onChange={(e) => setSelectedSubEventType(e.target.value)} className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium appearance-none focus:outline-none focus:border-emerald-600 ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-300 text-zinc-800"}`}>
                <option value="">All event subtypes</option>
                {subEventTypesList.map((subtype) => <option key={subtype} value={subtype}>{subtype === "Abduction/forced disappearance" ? `Kidnappings / forced abductions (ACLED: ${subtype}) · ${subEventTypeCounts.get(subtype)?.toLocaleString() ?? 0}` : `${subtype} · ${subEventTypeCounts.get(subtype)?.toLocaleString() ?? 0}`}</option>)}
              </select>
            </div>

            {/* Date filter: Year + Month */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label
                  className={`text-[11px] font-medium ${
                    isDark ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  Year
                </label>
                <div className="relative">
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer appearance-none focus:outline-none focus:border-emerald-600 ${
                      isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                        : "bg-white border-zinc-300 text-zinc-800"
                    }`}
                  >
                    <option value="">All Years</option>
                    {yearsList.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] ${
                      isDark ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    ▼
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  className={`text-[11px] font-medium ${
                    isDark ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  Month
                </label>
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer appearance-none focus:outline-none focus:border-emerald-600 ${
                      isDark
                        ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                        : "bg-white border-zinc-300 text-zinc-800"
                    }`}
                  >
                    <option value="">All Months</option>
                    {monthsList.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <span
                    className={`pointer-events-none absolute inset-y-0 right-3 flex items-center text-[10px] ${
                      isDark ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    ▼
                  </span>
                </div>
              </div>
            </div>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className={`w-full text-[11px] underline underline-offset-2 transition-colors ${
                  isDark
                    ? "text-zinc-500 hover:text-zinc-300"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Stats */}
          <div
            className={`border-t p-4 space-y-3 ${
              isDark ? "border-zinc-900" : "border-zinc-200"
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {selectedStateName
                ? `${selectedStateName}${selectedLga ? ` · ${selectedLga}` : ""}`
                : "All of Nigeria"}
              {selectedMonth || selectedYear
                ? ` · ${[selectedMonth, selectedYear].filter(Boolean).join(" ")}`
                : ""}
            </p>

            {loadState === "loading" && (
              <p
                className={`text-[11px] animate-pulse ${
                  isDark ? "text-zinc-600" : "text-zinc-400"
                }`}
              >
                Loading dataset…
              </p>
            )}
            {loadState === "error" && (
              <p className="text-[11px] text-red-500">
                Failed to load data. Reload to retry.
              </p>
            )}
            {loadState === "ready" && (
              <div className="space-y-2">
                <Stat
                  label="Incidents in map view"
                  value={filteredEvents.reduce((sum, ev) => sum + ev.incidentCount, 0)}
                  isDark={isDark}
                />
                <Stat
                  label="Reported casualties"
                  value={totalCasualties}
                  highlight
                  isDark={isDark}
                />
                <Stat
                  label="Total dataset"
                  value={allEvents.length}
                  dim
                  isDark={isDark}
                />
              </div>
            )}
          </div>


          {/* Event list */}
          {loadState === "ready" && filteredEvents.length === 0 && (
            <div className={`border-t p-4 text-xs ${isDark ? "border-zinc-900 text-zinc-500" : "border-zinc-200 text-zinc-500"}`}>No incidents in this map view for the selected filters.</div>
          )}
          {loadState === "ready" && filteredEvents.length > 0 && (
            <div
              className={`border-t p-4 space-y-2 ${
                isDark ? "border-zinc-900" : "border-zinc-200"
              }`}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Recent Events
              </p>
              {filteredEvents.slice(0, 12).map((ev, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedConflict(ev);
                    setMapFocus([...ev.coordinates] as [number, number]);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl border transition-all group ${
                    isDark
                      ? "bg-zinc-900/60 hover:bg-zinc-800/60 border-zinc-800/50 hover:border-zinc-700"
                      : "bg-zinc-100/70 hover:bg-zinc-200/70 border-zinc-200 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        ev.alertType === "Armed Clashes & Attacks"
                          ? isDark
                            ? "bg-amber-900/40 text-amber-400"
                            : "bg-amber-100 text-amber-800"
                          : isDark
                            ? "bg-red-900/40 text-red-400"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {ev.eventType || ev.alertType}
                    </span>
                    <span
                      className={`text-[9px] font-mono ${
                        isDark ? "text-zinc-600" : "text-zinc-400"
                      }`}
                    >
                      {ev.month} {ev.year}
                    </span>
                  </div>
                  <p
                    className={`text-xs font-semibold truncate ${
                      isDark
                        ? "text-zinc-200 group-hover:text-white"
                        : "text-zinc-800 group-hover:text-zinc-950"
                    }`}
                  >
                    {ev.lga}, {ev.state}
                  </p>
                  {ev.subEventType && <p className={`text-[10px] font-semibold ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{ev.subEventType}</p>}
                {ev.description && <p className={`text-[10px] leading-4 line-clamp-3 ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>{ev.description}</p>}
                <p className={`text-[10px] font-mono ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>
                  {ev.incidentCount} {ev.incidentCount === 1 ? "incident" : "incidents"} ·{" "}
                  <span className={isDark ? "text-red-400" : "text-red-600"}>
                    {ev.reportedCasualties} casualties
                  </span>
                </p>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── Map — always mounted, never waits for data ─────────────────── */}
        <main className="flex-1 min-h-0 relative">
          <LiveTrackerMap
            stateName={selectedStateName}
            lgaName={selectedLga}
            eventsList={controlFilteredEvents}
            onVisibleBoundsChange={setVisibleMapBounds}
            onMapLocationSelect={handleMapLocationSelect}
            cardFocusedCoords={mapFocus}
            theme={theme}
          />

          {selectedConflict && (
            <section
              aria-label="Selected event notes"
              className={`absolute bottom-4 right-4 z-[1100] w-[min(26rem,calc(100%-2rem))] max-h-[55vh] overflow-y-auto rounded-2xl border p-4 shadow-2xl ${isDark ? "bg-zinc-950/95 border-zinc-700 text-zinc-100" : "bg-white/95 border-zinc-300 text-zinc-900"}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-emerald-400" : "text-emerald-700"}`}>Event notes</p>
                  <h2 className="mt-1 text-base font-bold">{selectedConflict.subEventType || selectedConflict.eventType || selectedConflict.alertType}</h2>
                </div>
                <button type="button" onClick={() => setSelectedConflict(null)} className={`rounded-lg px-2 py-1 text-lg leading-none ${isDark ? "text-zinc-400 hover:bg-zinc-800" : "text-zinc-500 hover:bg-zinc-100"}`} aria-label="Close conflict details">×</button>
              </div>
              <div className={`mt-3 border-t pt-3 ${isDark ? "border-zinc-800" : "border-zinc-200"}`}>
                <p className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-zinc-500" : "text-zinc-500"}`}>{selectedConflict.eventDate || [selectedConflict.month, selectedConflict.year].join(" ")} · {selectedConflict.lga}, {selectedConflict.state}</p>
                <p className={`mt-1 text-xs leading-5 ${isDark ? "text-zinc-300" : "text-zinc-700"}`}>{selectedConflict.description || "Narrative notes are not included in the monthly summary data. The supplied ACLED event file ends on 17 October 2025."}</p>
              </div>
            </section>
          )}

          {loadState === "loading" && (
            <div
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 border text-xs font-medium px-4 py-2 rounded-full backdrop-blur-sm pointer-events-none z-[1000] ${
                isDark
                  ? "bg-zinc-900/90 border-zinc-700 text-zinc-300"
                  : "bg-white/90 border-zinc-300 text-zinc-700"
              }`}
            >
              <span className="animate-pulse">Fetching conflict dataset…</span>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
  dim,
  isDark,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  dim?: boolean;
  isDark: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span
        className={`text-[11px] ${
          dim
            ? isDark
              ? "text-zinc-600"
              : "text-zinc-400"
            : isDark
              ? "text-zinc-400"
              : "text-zinc-500"
        }`}
      >
        {label}
      </span>
      <span
        className={`text-xs font-bold font-mono ${
          highlight
            ? isDark
              ? "text-red-400"
              : "text-red-600"
            : dim
              ? isDark
                ? "text-zinc-600"
                : "text-zinc-400"
              : isDark
                ? "text-zinc-200"
                : "text-zinc-800"
        }`}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}

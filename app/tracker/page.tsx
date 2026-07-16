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
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { State, City } from "country-state-city";
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

  // ── Filter state ──────────────────────────────────────────────────────────
  const statesList = useMemo(() => State.getStatesOfCountry("NG"), []);

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

  const lgasList = useMemo(() => {
    if (!selectedStateCode) return [];
    return City.getCitiesOfState("NG", selectedStateCode);
  }, [selectedStateCode]);

  // ── Data — fetched once ───────────────────────────────────────────────────
  const [allEvents, setAllEvents] = useState<ConflictEvent[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    setLoadState("loading");

    fetch("/api/conflicts")
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

  // ── Client-side filtering ─────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!allEvents.length) return [];

    return allEvents.filter((ev) => {
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
  }, [allEvents, selectedStateCode, selectedLga, selectedYear, selectedMonth, statesList]);

  // ── Map focus ─────────────────────────────────────────────────────────────
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);

  // Guards against the dropdown-sync effects below stomping on a focus point
  // that was just set explicitly by a map click or "Use Your Location". Set
  // to true right before we know a state/LGA change is about to be caused by
  // reverse-geocoding rather than the user picking a dropdown directly.
  const suppressAutoFocusRef = useRef(false);

  // State dropdown → fly to first matching event
  useEffect(() => {
    if (suppressAutoFocusRef.current) return;
    if (!selectedStateCode) {
      setMapFocus(null);
      return;
    }
    const stateObj = statesList.find((s) => s.isoCode === selectedStateCode);
    if (!stateObj) return;
    const target = stateObj.name.replace(/\s*State$/i, "").toLowerCase();
    const match = allEvents.find((ev) =>
      ev.state.toLowerCase().includes(target),
    );
    if (match) setMapFocus([...match.coordinates] as [number, number]);
  }, [selectedStateCode, allEvents, statesList]);

  // LGA dropdown → narrow focus
  useEffect(() => {
    if (suppressAutoFocusRef.current) return;
    if (!selectedLga) return;
    const norm = (s: string) =>
      s.toLowerCase().replace(/[-\s]/g, "").replace(/ss/g, "s");
    const match = allEvents.find((ev) =>
      norm(ev.lga).includes(norm(selectedLga)),
    );
    if (match) setMapFocus([...match.coordinates] as [number, number]);
  }, [selectedLga, allEvents]);

  // ── Reverse geocode → update dropdowns ───────────────────────────────────
  const [geoLoading, setGeoLoading] = useState(false);

  const applyReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      // Show the point immediately — this is the actual coordinate the user
      // clicked or was located at, and it must win regardless of whether the
      // geocode lookup below succeeds, fails, or matches a dropdown entry.
      suppressAutoFocusRef.current = true;
      setMapFocus([lat, lng]);

      try {
        // Mapbox reverse geocode — replaces Nominatim
        const result = await reverseGeocode(lat, lng);
        if (!result) return;

        const matchedState = statesList.find((s) =>
          s.name
            .replace(/\s*State$/i, "")
            .toLowerCase()
            .includes(result.state.toLowerCase()),
        );

        if (matchedState) {
          setSelectedStateCode(matchedState.isoCode);
          const lgas = City.getCitiesOfState("NG", matchedState.isoCode);
          const matchedLga = lgas.find((c) =>
            c.name.toLowerCase().includes(result.lga.toLowerCase()),
          );
          setSelectedLga(matchedLga?.name ?? "");
        }
      } catch (err) {
        console.error("Reverse geocode failed:", err);
      } finally {
        // Release the guard after this commit + the dropdown-sync effects
        // it triggers have both had a chance to run, so they don't fly the
        // map away from the point we just set above.
        setTimeout(() => {
          suppressAutoFocusRef.current = false;
        }, 0);
      }
    },
    [statesList],
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
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const isDark = theme === "dark";

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
    selectedStateCode || selectedLga || selectedYear || selectedMonth;

  const clearAllFilters = () => {
    setSelectedStateCode("");
    setSelectedLga("");
    setSelectedYear("");
    setSelectedMonth("");
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
          isDark
            ? "bg-zinc-950 border-zinc-900"
            : "bg-white border-zinc-200"
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span
            className={`text-xs font-bold tracking-wide ${
              isDark ? "text-zinc-100" : "text-zinc-900"
            }`}
          >
            NigeriaWatch · Live Tracker
          </span>
        </div>
        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border transition-colors ${
            isDark
              ? "text-zinc-400 hover:text-zinc-200 bg-zinc-900 border-zinc-800"
              : "text-zinc-600 hover:text-zinc-900 bg-zinc-100 border-zinc-300"
          }`}
        >
          {isDark ? "☀ Light" : "◑ Dark"}
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside
          className={`w-72 flex-none flex flex-col overflow-y-auto border-r ${
            isDark
              ? "bg-zinc-950 border-zinc-900"
              : "bg-white border-zinc-200"
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
                  }}
                  className={`w-full border rounded-xl px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer appearance-none focus:outline-none focus:border-emerald-600 ${
                    isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-200"
                      : "bg-white border-zinc-300 text-zinc-800"
                  }`}
                >
                  <option value="">All States</option>
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
                  onChange={(e) => setSelectedLga(e.target.value)}
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
                  label="Matched incidents"
                  value={filteredEvents.length}
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
                  onClick={() =>
                    setMapFocus([...ev.coordinates] as [number, number])
                  }
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
                      {ev.alertType}
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
                  <p
                    className={`text-[10px] font-mono ${
                      isDark ? "text-zinc-500" : "text-zinc-500"
                    }`}
                  >
                    {ev.incidentCount} incidents ·{" "}
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
        <main className="flex-1 relative">
          <LiveTrackerMap
            stateName={selectedStateName}
            lgaName={selectedLga}
            eventsList={filteredEvents}
            onMapLocationSelect={handleMapLocationSelect}
            cardFocusedCoords={mapFocus}
            theme={theme}
          />

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
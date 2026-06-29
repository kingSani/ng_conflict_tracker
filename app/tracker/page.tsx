"use client";

/**
 * /app/tracker/page.tsx
 *
 * Changes from previous version:
 *  - reverseGeocode() now calls Mapbox instead of Nominatim
 *  - Everything else (single fetch, client-side filter, bidirectional
 *    sync, geolocation button) is unchanged.
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

      return true;
    });
  }, [allEvents, selectedStateCode, selectedLga, statesList]);

  // ── Map focus ─────────────────────────────────────────────────────────────
  const [mapFocus, setMapFocus] = useState<[number, number] | null>(null);

  // State dropdown → fly to first matching event
  useEffect(() => {
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

      setMapFocus([lat, lng]);
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
        await applyReverseGeocode(coords.latitude, coords.longitude);
        setGeoLoading(false);
      },
      () => setGeoLoading(false),
      { timeout: 8000 },
    );
  }, [applyReverseGeocode]);

  // ── Theme ─────────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  // ── Derived display values ────────────────────────────────────────────────
  const selectedStateName =
    statesList
      .find((s) => s.isoCode === selectedStateCode)
      ?.name.replace(/\s*State$/i, "") || "";

  const totalCasualties = filteredEvents.reduce(
    (sum, ev) => sum + ev.reportedCasualties,
    0,
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-zinc-950 flex flex-col overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="flex-none flex items-center justify-between px-4 py-2.5 bg-zinc-950 border-b border-zinc-900 z-10">
        <div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-zinc-100 tracking-wide">
            NigeriaWatch · Live Tracker
          </span>
        </div>
        <button
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="text-[10px] font-medium text-zinc-400 hover:text-zinc-200 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 transition-colors"
        >
          {theme === "dark" ? "☀ Light" : "◑ Dark"}
        </button>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <aside className="w-72 flex-none flex flex-col bg-zinc-950 border-r border-zinc-900 overflow-y-auto">
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-0.5">
                Filter Location
              </p>
              <p className="text-[11px] text-zinc-500">
                Dropdowns and map stay in sync automatically.
              </p>
            </div>

            {/* Use Your Location */}
            <button
              onClick={handleUseLocation}
              disabled={geoLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-emerald-700 text-xs font-semibold text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <label className="text-[11px] font-medium text-zinc-400">
                State
              </label>
              <div className="relative">
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    setSelectedLga("");
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-600 font-medium transition-colors cursor-pointer appearance-none"
                >
                  <option value="">All States</option>
                  {statesList.map((s) => (
                    <option key={s.isoCode} value={s.isoCode}>
                      {s.name.replace(/\s*State$/i, "")}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500 text-[10px]">
                  ▼
                </span>
              </div>
            </div>

            {/* LGA dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium text-zinc-400">
                Local Govt. Area
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedStateCode}
                  onChange={(e) => setSelectedLga(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-600 font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed appearance-none"
                >
                  <option value="">All LGAs</option>
                  {lgasList.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-zinc-500 text-[10px]">
                  ▼
                </span>
              </div>
            </div>

            {(selectedStateCode || selectedLga) && (
              <button
                onClick={() => {
                  setSelectedStateCode("");
                  setSelectedLga("");
                  setMapFocus(null);
                }}
                className="w-full text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Stats */}
          <div className="border-t border-zinc-900 p-4 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {selectedStateName
                ? `${selectedStateName}${selectedLga ? ` · ${selectedLga}` : ""}`
                : "All of Nigeria"}
            </p>

            {loadState === "loading" && (
              <p className="text-[11px] text-zinc-600 animate-pulse">
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
                <Stat label="Matched incidents" value={filteredEvents.length} />
                <Stat
                  label="Reported casualties"
                  value={totalCasualties}
                  highlight
                />
                <Stat label="Total dataset" value={allEvents.length} dim />
              </div>
            )}
          </div>

          {/* Event list */}
          {loadState === "ready" && filteredEvents.length > 0 && (
            <div className="border-t border-zinc-900 p-4 space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
                Recent Events
              </p>
              {filteredEvents.slice(0, 12).map((ev, i) => (
                <button
                  key={i}
                  onClick={() =>
                    setMapFocus([...ev.coordinates] as [number, number])
                  }
                  className="w-full text-left p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/60 border border-zinc-800/50 hover:border-zinc-700 transition-all group"
                >
                  <div className="flex justify-between items-center mb-0.5">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        ev.alertType === "Armed Clashes & Attacks"
                          ? "bg-amber-900/40 text-amber-400"
                          : "bg-red-900/40 text-red-400"
                      }`}
                    >
                      {ev.alertType}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-mono">
                      {ev.month} {ev.year}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white">
                    {ev.lga}, {ev.state}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    {ev.incidentCount} incidents ·{" "}
                    <span className="text-red-400">
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
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-zinc-700 text-zinc-300 text-xs font-medium px-4 py-2 rounded-full backdrop-blur-sm pointer-events-none z-[1000]">
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
}: {
  label: string;
  value: number;
  highlight?: boolean;
  dim?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span
        className={`text-[11px] ${dim ? "text-zinc-600" : "text-zinc-400"}`}
      >
        {label}
      </span>
      <span
        className={`text-xs font-bold font-mono ${
          highlight ? "text-red-400" : dim ? "text-zinc-600" : "text-zinc-200"
        }`}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { State, City } from "country-state-city";

const LiveTrackerMap = dynamic(() => import("../components/LiveTrackerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center text-zinc-500 font-mono text-xs">
      LOADING MAP CONTENT...
    </div>
  ),
});

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

function TrackerDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const theme = searchParams.get("theme") === "light" ? "light" : "dark";
  const initialState = searchParams.get("state") || "";
  const initialLga = searchParams.get("lga") || "";

  const statesList = useMemo(() => State.getStatesOfCountry("NG"), []);
  const initialStateObj = statesList.find(
    (s) => s.name.replace(" State", "") === initialState,
  );

  const [selectedStateCode, setSelectedStateCode] = useState<string>(
    initialStateObj?.isoCode || "",
  );
  const [selectedLga, setSelectedLga] = useState<string>(initialLga);

  // Industry Standard Split Date Selection States
  const [startMonth, setStartMonth] = useState<string>("January");
  const [startYear, setStartYear] = useState<string>("2025");

  // Strict Pagination Page Indexing State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 10; // Capped hard-limit index parameters

  const [focusedLocation, setFocusedLocation] = useState<
    [number, number] | null
  >(null);
  const [conflicts, setConflicts] = useState<ConflictEvent[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);

  const lgasList = selectedStateCode
    ? City.getCitiesOfState("NG", selectedStateCode)
    : [];
  const activeStateName =
    statesList
      .find((s) => s.isoCode === selectedStateCode)
      ?.name.replace(" State", "") || "";

  // Available Years Registry Matrix
  const yearsOptions = ["2024", "2025", "2026"];
  const monthsOptions = [
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

  const syncLocationParams = (stateCode: string, lgaVal: string) => {
    const stateObj = statesList.find((s) => s.isoCode === stateCode);
    const params = new URLSearchParams(searchParams.toString());
    if (stateObj) params.set("state", stateObj.name.replace(" State", ""));
    else params.delete("state");
    if (lgaVal) params.set("lga", lgaVal);
    else params.delete("lga");
    router.replace(`/tracker?${params.toString()}`);
  };

  const handleUnifiedMapSelect = (stateCodeVal: string, lgaVal: string) => {
    setSelectedStateCode(stateCodeVal);
    setSelectedLga(lgaVal);
    syncLocationParams(stateCodeVal, lgaVal);
  };

  useEffect(() => {
    async function fetchConflicts() {
      setLoadingData(true);
      try {
        const url = `/api/conflicts?state=${encodeURIComponent(activeStateName)}&lga=${encodeURIComponent(selectedLga)}&startYear=${startYear}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error("API network parsing failure");
        const data = await res.json();

        if (Array.isArray(data)) {
          // Additional filtering step based on your premium Month selection choice
          const startMonthIndex = monthsOptions.indexOf(startMonth);
          const filteredByMonth = data.filter((item) => {
            if (item.year > parseInt(startYear)) return true;
            if (item.year === parseInt(startYear)) {
              const itemMonthIndex = monthsOptions.indexOf(item.month);
              return itemMonthIndex >= startMonthIndex;
            }
            return false;
          });
          setConflicts(filteredByMonth);
        } else {
          setConflicts([]);
        }
      } catch (err) {
        console.error("Error formatting records:", err);
        setConflicts([]);
      } finally {
        setLoadingData(false);
      }
    }

    fetchConflicts();
    setCurrentPage(1); // Reset back to page 1 whenever any active filter changes
    setFocusedLocation(null);
  }, [activeStateName, selectedLga, startMonth, startYear]);

  // Strict Math Chunk Slicing Loop: Ensures EXACTLY 10 items display at a time
  const totalPages = Math.ceil(conflicts.length / itemsPerPage);
  const visibleConflicts = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return conflicts.slice(startIdx, startIdx + itemsPerPage);
  }, [conflicts, currentPage]);

  return (
    <main className="h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row pt-16 overflow-hidden text-zinc-900 dark:text-zinc-100 transition-colors">
      <section className="w-full md:w-[420px] bg-white dark:bg-zinc-900/60 border-b md:border-b-0 md:border-r border-zinc-200 dark:border-zinc-900 p-5 flex flex-col justify-between shrink-0 z-20 overflow-y-auto transition-colors">
        <div className="space-y-5">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-2 border border-emerald-200 dark:border-emerald-900/30">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Monitoring System
            </div>
            <h1 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">
              System Controls
            </h1>
          </div>

          {/* Upgraded Premium Dual Selector Dashboard Controls */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              Timeline Threshold
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 appearance-none font-medium transition-colors"
                >
                  {monthsOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                  ▼
                </div>
              </div>

              <div className="relative">
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 appearance-none font-medium transition-colors"
                >
                  {yearsOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* Regional Geographic Filters */}
          <div className="space-y-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                State
              </label>
              <div className="relative">
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    setSelectedLga("");
                    syncLocationParams(e.target.value, "");
                  }}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 appearance-none font-medium transition-colors"
                >
                  <option value="">All States</option>
                  {statesList.map((s) => (
                    <option key={s.isoCode} value={s.isoCode}>
                      {s.name.replace(" State", "")}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                Local Government (LGA)
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedStateCode}
                  onChange={(e) => {
                    setSelectedLga(e.target.value);
                    syncLocationParams(selectedStateCode, e.target.value);
                  }}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 appearance-none font-medium disabled:opacity-30 transition-colors"
                >
                  <option value="">All LGAs</option>
                  {lgasList.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Feed Segment Panel */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                Local Safety Alerts
              </h2>
              {conflicts.length > 0 && (
                <span className="text-[10px] font-mono font-bold bg-zinc-100 dark:bg-zinc-950 px-2 py-0.5 border border-zinc-200 dark:border-zinc-800 rounded-md text-zinc-500">
                  Total Logs: {conflicts.length}
                </span>
              )}
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {loadingData ? (
                <div className="text-center py-6 text-xs text-zinc-500 font-mono animate-pulse">
                  UPDATING FEEDS...
                </div>
              ) : conflicts.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-500 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl px-4">
                  No security incidents recorded for this criteria.
                </div>
              ) : (
                <>
                  {visibleConflicts.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => setFocusedLocation(item.coordinates)}
                      className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 rounded-xl p-4 space-y-2 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all cursor-pointer transform hover:-translate-y-0.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            item.alertType === "Armed Clashes & Attacks"
                              ? "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                              : "bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-900/40"
                          }`}
                        >
                          {item.alertType}
                        </span>
                        <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
                          {item.month} {item.year}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                        {item.lga}, {item.state}
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-900/60 text-[11px] font-medium">
                        <div className="text-zinc-500 dark:text-zinc-400">
                          Incidents:{" "}
                          <span className="text-zinc-900 dark:text-zinc-100 font-bold font-mono">
                            {item.incidentCount}
                          </span>
                        </div>
                        <div className="text-zinc-500 dark:text-zinc-400">
                          Casualties:{" "}
                          <span
                            className={`${item.reportedCasualties > 0 ? "text-red-500 dark:text-red-400 font-bold" : "text-zinc-500 dark:text-zinc-400"} font-mono`}
                          >
                            {item.reportedCasualties}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Clean, Non-Expanding Pagination Row View Controls */}
                  {totalPages > 1 && (
                    <div className="grid grid-cols-3 items-center gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-900 text-xs font-semibold text-zinc-500">
                      <button
                        disabled={currentPage === 1}
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(prev - 1, 1))
                        }
                        className="py-2 text-center bg-zinc-100 dark:bg-zinc-900 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 border border-zinc-200 dark:border-zinc-800 transition-colors"
                      >
                        ◀ Back
                      </button>
                      <div className="text-center font-mono text-[11px] text-zinc-400">
                        Page {currentPage} / {totalPages}
                      </div>
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(prev + 1, totalPages),
                          )
                        }
                        className="py-2 text-center bg-zinc-100 dark:bg-zinc-900 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-30 border border-zinc-200 dark:border-zinc-800 transition-colors"
                      >
                        Next ▶
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="flex-grow h-full relative z-10">
        <LiveTrackerMap
          stateName={activeStateName}
          lgaName={selectedLga}
          eventsList={conflicts}
          onMapLocationSelect={handleUnifiedMapSelect}
          cardFocusedCoords={focusedLocation}
          theme={theme}
        />
      </section>
    </main>
  );
}

export default function TrackerDashboard() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
          Opening secure dashboard console...
        </div>
      }
    >
      <TrackerDashboardContent />
    </Suspense>
  );
}

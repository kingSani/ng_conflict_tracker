"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

const LiveTrackerMap = dynamic(() => import("../components/LiveTrackerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-mono text-xs">
      LOADING MAP CANVAS...
    </div>
  ),
});

function TrackerDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialState = searchParams.get("state") || "";
  const initialLga = searchParams.get("lga") || "";

  const [statesList, setStatesList] = useState<string[]>([]);
  const [lgasList, setLgasList] = useState<string[]>([]);

  const [selectedState, setSelectedState] = useState<string>(initialState);
  const [selectedLga, setSelectedLga] = useState<string>(initialLga);
  const [loadingLgas, setLoadingLgas] = useState<boolean>(false);

  useEffect(() => {
    async function fetchNigerianStates() {
      try {
        const response = await fetch(
          "https://nga-states-lga.onrender.com/fetch",
        );
        if (!response.ok) throw new Error("Server error");
        const data = await response.json();
        setStatesList(data || []);
      } catch (error) {
        console.error("Could not load states:", error);
        setStatesList([
          "Abia",
          "Adamawa",
          "Borno",
          "FCT - Abuja",
          "Kano",
          "Lagos",
          "Rivers",
        ]);
      }
    }
    fetchNigerianStates();
  }, []);

  useEffect(() => {
    if (!selectedState) return;

    async function fetchCorrespondingLgas() {
      setLoadingLgas(true);
      try {
        const response = await fetch(
          `https://nga-states-lga.onrender.com/?state=${encodeURIComponent(selectedState)}`,
        );
        if (!response.ok) throw new Error("Server error");
        const data = await response.json();
        setLgasList(data || []);
      } catch (error) {
        console.error("Could not load local areas:", error);
        if (selectedState === "Rivers")
          setLgasList(["Port Harcourt", "Obio-Akpor", "Eleme", "Bonny"]);
        else setLgasList(["Central Area"]);
      } finally {
        setLoadingLgas(false);
      }
    }

    fetchCorrespondingLgas();
  }, [selectedState]);

  const handleLocationUpdate = (stateVal: string, lgaVal: string) => {
    const params = new URLSearchParams();
    if (stateVal) params.set("state", stateVal);
    if (lgaVal) params.set("lga", lgaVal);
    router.replace(`/tracker?${params.toString()}`);
  };

  return (
    <main className="h-screen w-full bg-zinc-50 flex flex-col md:flex-row pt-16 overflow-hidden text-zinc-800">
      {/* SIDEBAR COMPONENT: Filter Panel Controls */}
      <section className="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-zinc-200 p-5 flex flex-col justify-between shrink-0 z-20 shadow-sm">
        <div className="space-y-6">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-50 text-[11px] font-semibold text-emerald-700 mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Workspace
            </div>
            <h1 className="text-lg font-bold text-zinc-900 tracking-tight">
              Map Filters
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              Select an area below to filter active security reports.
            </p>
          </div>

          {/* Form Filter Fields */}
          <div className="space-y-4">
            {/* Input Wrapper: State */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                State
              </label>
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedState(val);
                    setSelectedLga("");
                    if (!val) setLgasList([]);
                    handleLocationUpdate(val, "");
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer appearance-none font-medium"
                >
                  <option value="">All States</option>
                  {statesList.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Input Wrapper: Local Government */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Local Government (LGA)
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedState || loadingLgas}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedLga(val);
                    handleLocationUpdate(selectedState, val);
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed appearance-none font-medium"
                >
                  <option value="">
                    {loadingLgas ? "Loading areas..." : "All Local Governments"}
                  </option>
                  {lgasList.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Location Information Summary Card */}
        <div className="mt-6 pt-4 border-t border-zinc-100 hidden md:block">
          <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Active Target Focus
            </span>
            <p className="text-sm font-bold text-zinc-800 mt-0.5 truncate">
              {selectedState || "Whole Country"}
            </p>
            {selectedLga && (
              <p className="text-xs text-emerald-600 font-medium mt-0.5 truncate">
                {selectedLga} District
              </p>
            )}
          </div>
        </div>
      </section>

      {/* MAP CANVAS VIEWPORT REGION */}
      <section className="flex-grow h-full relative z-10 bg-zinc-100">
        <LiveTrackerMap stateName={selectedState} lgaName={selectedLga} />
      </section>
    </main>
  );
}

export default function TrackerDashboard() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-full bg-zinc-50 flex items-center justify-center text-zinc-500 font-sans text-sm">
          Opening security console...
        </div>
      }
    >
      <TrackerDashboardContent />
    </Suspense>
  );
}

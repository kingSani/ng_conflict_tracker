"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { State, City } from "country-state-city";

const LiveTrackerMap = dynamic(() => import("../components/LiveTrackerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-sans text-xs">
      LOADING MAP CANVAS...
    </div>
  ),
});

function TrackerDashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialState = searchParams.get("state") || "";
  const initialLga = searchParams.get("lga") || "";

  // Get the full list of Nigerian states locally
  const statesList = State.getStatesOfCountry("NG");

  // Find the initial state code if coming from the landing page
  const initialStateObj = statesList.find(
    (s) => s.name.replace(" State", "") === initialState,
  );
  const [selectedStateCode, setSelectedStateCode] = useState<string>(
    initialStateObj?.isoCode || "",
  );
  const [selectedLga, setSelectedLga] = useState<string>(initialLga);

  // NEW STATE: Holds custom GPS coordinates when the user requests device location
  const [userGpsCoords, setUserGpsCoords] = useState<[number, number] | null>(
    null,
  );
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);

  // Get matching LGAs based on the active state code selection
  const lgasList = selectedStateCode
    ? City.getCitiesOfState("NG", selectedStateCode)
    : [];

  const handleLocationUpdate = (stateCodeVal: string, lgaVal: string) => {
    setUserGpsCoords(null); // Clear GPS pinpoint if dropdown filters are used
    const stateObj = statesList.find((s) => s.isoCode === stateCodeVal);

    const params = new URLSearchParams();
    if (stateObj) params.set("state", stateObj.name.replace(" State", ""));
    if (lgaVal) params.set("lga", lgaVal);
    router.replace(`/tracker?${params.toString()}`);
  };

  // NEW FUNCTION: Requests browser geolocation permissions
  const handleGetBrowserLocation = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support automatic location detection.");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserGpsCoords([latitude, longitude]);

        // Reset sidebar inputs to default states since we are using explicit GPS coordinates
        setSelectedStateCode("");
        setSelectedLga("");
        router.replace("/tracker"); // Clear URL queries
        setGpsLoading(false);
      },
      (error) => {
        console.error("Error getting location:", error);
        alert(
          "Unable to retrieve your location. Please check your browser location permissions.",
        );
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Convert selected state code back to its human-readable name for the map component
  const activeStateName =
    statesList
      .find((s) => s.isoCode === selectedStateCode)
      ?.name.replace(" State", "") || "";

  return (
    <main className="h-screen w-full bg-zinc-50 flex flex-col md:flex-row pt-16 overflow-hidden text-zinc-800">
      {/* SIDEBAR: Controls Layout */}
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
              Select an area or use your live location to view recent updates.
            </p>
          </div>

          <div className="space-y-4">
            {/* NEW ELEMENT: Locate Me Interactive Button */}
            <button
              type="button"
              onClick={handleGetBrowserLocation}
              disabled={gpsLoading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-50 hover:bg-emerald-100/80 disabled:bg-zinc-100 text-emerald-700 disabled:text-zinc-400 font-bold text-xs py-3 px-4 rounded-xl transition-all border border-emerald-200/40"
            >
              <svg
                className={`h-4 w-4 ${gpsLoading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {gpsLoading ? "Locating Your Device..." : "Use My Location"}
            </button>

            <div className="relative flex py-2 items-center text-zinc-300">
              <div className="flex-grow border-t border-zinc-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold tracking-wider font-mono text-zinc-400 uppercase">
                OR
              </span>
              <div className="flex-grow border-t border-zinc-200"></div>
            </div>

            {/* State Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                State
              </label>
              <div className="relative">
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedStateCode(val);
                    setSelectedLga("");
                    handleLocationUpdate(val, "");
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer appearance-none font-medium"
                >
                  <option value="">All States</option>
                  {statesList.map((state) => (
                    <option key={state.isoCode} value={state.isoCode}>
                      {state.name.replace(" State", "")}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-zinc-400 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* LGA Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-600">
                Local Government (LGA)
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedStateCode}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedLga(val);
                    handleLocationUpdate(selectedStateCode, val);
                  }}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3.5 py-2.5 text-sm text-zinc-800 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed appearance-none font-medium"
                >
                  <option value="">All Local Governments</option>
                  {lgasList.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
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

        <div className="mt-6 pt-4 border-t border-zinc-100 hidden md:block">
          <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-100 text-xs">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Active Workspace View
            </span>
            <p className="font-bold text-zinc-800 mt-0.5 truncate">
              {userGpsCoords
                ? "📍 Custom Device GPS Location"
                : activeStateName || "Whole Country"}
            </p>
          </div>
        </div>
      </section>

      {/* MAP CANVAS VIEWPORT */}
      <section className="flex-grow h-full relative z-10 bg-zinc-100">
        {/* Pass the dynamic GPS coordinate values down into the map component wrapper */}
        <LiveTrackerMap
          stateName={activeStateName}
          lgaName={selectedLga}
          gpsCoords={userGpsCoords}
        />
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

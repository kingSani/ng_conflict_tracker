"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getNigeriaGeoData, NigeriaGeoData } from "./lib/nigeria-geo";

export default function LandingPage() {
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
    description?: string;
  }
  const [previewAlerts, setPreviewAlerts] = useState<ConflictEvent[]>([]);

  useEffect(() => {
    // Pull default overview metrics directly from the new shared API route
    fetch("/api/conflicts?year=2026&limit=3")
      .then((res) => res.json())
      .then((data) => setPreviewAlerts(data))
      .catch((err) => console.error(err));
  }, []);
  const router = useRouter();

  const [geoData, setGeoData] = useState<NigeriaGeoData | null>(null);
  const [geoDataError, setGeoDataError] = useState(false);

  useEffect(() => {
    let active = true;
    getNigeriaGeoData()
      .then((data) => { if (active) setGeoData(data); })
      .catch((error) => { console.error("Failed to load Nigeria Geo API data:", error); if (active) setGeoDataError(true); });
    return () => { active = false; };
  }, []);

  const statesList = geoData?.states ?? [];
  const [selectedStateCode, setSelectedStateCode] = useState<string>("");
  const [selectedLga, setSelectedLga] = useState<string>("");

  const selectedState = statesList.find((state) => state.isoCode === selectedStateCode);
  const lgasList = useMemo(() => {
    if (!selectedState || !geoData) return [];
    return (geoData.lgasByState[selectedState.sourceName] ?? []).map((name) => ({ name }));
  }, [geoData, selectedState]);

  const handleLaunchTracker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStateCode) return;

    const stateObj = statesList.find((s) => s.isoCode === selectedStateCode);
    if (!stateObj) return;

    // Package the cleanly structured location parameters into query strings
    const query = new URLSearchParams({
      state: stateObj.name.replace(" State", ""),
      stateCode: selectedStateCode,
      ...(selectedLga && { lga: selectedLga }),
    }).toString();

    router.push(`/tracker?${query}`);
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col justify-center pt-16">
      {/* HERO SECTION: Human-friendly headings & Search Panel Controls */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side Container Layout */}
        <div className="lg:col-span-7 space-y-4 md:space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/50 text-xs font-medium text-emerald-400">
                        Live Security Updates
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white leading-tight">
            Track safety and security alerts <br />
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
              across Nigeria.
            </span>
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm sm:text-base lg:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Get clear, verified updates on incidents happening in your local
            area. Select your state and local government below to view the
            interactive map.
          </p>
        </div>

        {/* Right Side Search Panel Card Layout */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-900 p-5 sm:p-6 rounded-2xl backdrop-blur-sm shadow-xl w-full max-w-md mx-auto lg:max-w-none">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Find Your Area</h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Choose a location to see recent security status updates.
            </p>
          </div>

          <form onSubmit={handleLaunchTracker} className="space-y-4">
            {/* Dropdown: State Parameter Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">State</label>
              <div className="relative">
                <select
                  value={selectedStateCode}
                  onChange={(e) => {
                    setSelectedStateCode(e.target.value);
                    setSelectedLga("");
                  }}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer appearance-none"
                >
                  <option value="">{geoData ? "Choose a State..." : geoDataError ? "States unavailable" : "Loading states…"}</option>
                  {statesList.map((state) => (
                    <option key={state.isoCode} value={state.isoCode}>
                      {state.name.replace(" State", "")}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Dropdown: Local Government Area (LGA) Parameter Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Local Government Area (LGA)
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedStateCode}
                  onChange={(e) => setSelectedLga(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed appearance-none"
                >
                  <option value="">Choose a Local Govt...</option>
                  {lgasList.map((city) => (
                    <option key={city.name} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500 text-xs">
                  ▼
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedStateCode}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 dark:bg-zinc-800 text-zinc-950 disabled:text-zinc-600 font-bold text-sm py-3.5 px-4 rounded-xl transition-all duration-200 active:scale-[0.99] disabled:scale-100 shadow-md shadow-emerald-950/20"
            >
              View Active Map
            </button>
            {geoDataError && <p className="text-xs text-red-500" role="status">Location lists could not be loaded. Please refresh and try again.</p>}
          </form>
        </div>
      </section>

      {/* SECTION: About Us Portal Container */}
      <section className="border-t border-zinc-200 dark:border-zinc-900 bg-zinc-50 dark:bg-zinc-900/10 py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">
            Live Situation Briefing
          </h2>
          <h3 className="text-2xl font-extrabold text-zinc-900 dark:text-white mb-6">
            Recent Escalation Previews (Current Month)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {previewAlerts.map((alert, idx) => (
              <div
                key={idx}
                className="bg-zinc-100 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-4 space-y-2"
              >
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    {alert.eventType || alert.alertType}
                  </span>
                  <span className="text-zinc-500">
                    {alert.month} {alert.year}
                  </span>
                </div>
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {alert.lga}, {alert.state} State
                </p>
                {alert.subEventType && <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{alert.subEventType}</p>}
                {alert.description && <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3">{alert.description}</p>}
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Recorded Fatalities:{" "}
                  <span className="text-red-500 font-bold font-mono">
                    {alert.reportedCasualties}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION: Help / Support Desk Entry Panel */}
      <section id="support" className="bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">
            Support Desk
          </h2>
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white mb-4">
            Have questions or want to report an incident?
          </h3>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm max-w-xl mx-auto mb-8">
            If you are noticing incorrect information, having trouble using the
            tool, or want to learn how we verify our data, please get in touch
            with our team.
          </p>
          <button className="bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 text-sm font-semibold px-6 py-3 rounded-xl transition-colors w-full sm:w-auto">
            Contact Support Team
          </button>
        </div>
      </section>
    </main>
  );
}

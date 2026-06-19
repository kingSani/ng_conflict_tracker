"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  const [statesList, setStatesList] = useState<string[]>([]);
  const [lgasList, setLgasList] = useState<string[]>([]);

  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedLga, setSelectedLga] = useState<string>("");
  const [loadingLgas, setLoadingLgas] = useState<boolean>(false);

  // Get the list of Nigerian states when the page loads
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
        // Reliable fallback list so the site never breaks for users
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

  // Fetch cities/local governments when a state is picked
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

  const handleLaunchTracker = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedState) return;

    // Direct user to the map page with their chosen location details
    const query = new URLSearchParams({
      state: selectedState,
      ...(selectedLga && { lga: selectedLga }),
    }).toString();

    router.push(`/tracker?${query}`);
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center pt-16">
      {/* HERO SECTION: Text & Main Search Card */}
      <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12 md:py-20 lg:py-32 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Human-friendly headings */}
        <div className="lg:col-span-7 space-y-4 md:space-y-6 text-center lg:text-left">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/40 border border-emerald-900/50 text-xs font-medium text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Security Updates
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
            Track safety and security alerts <br />
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
              across Nigeria.
            </span>
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base lg:text-lg max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Get clear, verified updates on incidents happening in your local
            area. Select your state and local government below to view the
            interactive map.
          </p>
        </div>

        {/* Right Side: Simple Search Form */}
        <div className="lg:col-span-5 bg-zinc-900/40 border border-zinc-900 p-5 sm:p-6 rounded-2xl backdrop-blur-sm shadow-xl w-full max-w-md mx-auto lg:max-w-none">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-zinc-100">Find Your Area</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Choose a location to see recent security status updates.
            </p>
          </div>

          <form onSubmit={handleLaunchTracker} className="space-y-4">
            {/* Dropdown: State Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">State</label>
              <div className="relative">
                <select
                  value={selectedState}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedState(val);
                    setSelectedLga("");
                    if (!val) setLgasList([]);
                  }}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer appearance-none"
                >
                  <option value="">Choose a State...</option>
                  {statesList.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  ▼
                </div>
              </div>
            </div>

            {/* Dropdown: LGA/City Selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-400">
                Local Government Area (LGA)
              </label>
              <div className="relative">
                <select
                  value={selectedLga}
                  disabled={!selectedState || loadingLgas}
                  onChange={(e) => setSelectedLga(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-emerald-500 font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed appearance-none"
                >
                  <option value="">
                    {loadingLgas
                      ? "Loading local areas..."
                      : "Choose a Local Govt..."}
                  </option>
                  {lgasList.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-zinc-500">
                  ▼
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!selectedState}
              className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 text-zinc-950 disabled:text-zinc-600 font-bold text-sm py-3.5 px-4 rounded-xl transition-all duration-200 active:scale-[0.99] disabled:scale-100"
            >
              View Active Map
            </button>
          </form>
        </div>
      </section>

      {/* SECTION: About Us */}
      <section id="about" className="border-t border-zinc-900 bg-zinc-900/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 md:py-24">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-2">
            About This Project
          </h2>
          <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-4 sm:mb-6">
            Making safety information clear and accessible to everyone.
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 text-zinc-400 text-sm leading-relaxed">
            <p>
              Our conflict tracker is built to help ordinary citizens,
              travelers, and community members understand exactly what is going
              on in different regions. We pull verified reports from reliable
              news sources and security agencies to keep you informed.
            </p>
            <p>
              By separating our main home screen from the heavy visual map, we
              ensure the site runs incredibly fast even on slower mobile phone
              networks and devices across Nigeria.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION: Help / Support */}
      <section id="support" className="bg-zinc-950 border-t border-zinc-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-3">
            Support Desk
          </h2>
          <h3 className="text-xl sm:text-2xl font-bold text-white mb-4">
            Have questions or want to report an incident?
          </h3>
          <p className="text-zinc-400 text-sm max-w-xl mx-auto mb-8">
            If you are noticing incorrect information, having trouble using the
            tool, or want to learn how we verify our data, please get in touch
            with our team.
          </p>
          <button className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-sm font-semibold px-6 py-3 rounded-xl transition-colors w-full sm:w-auto">
            Contact Support Team
          </button>
        </div>
      </section>
    </main>
  );
}

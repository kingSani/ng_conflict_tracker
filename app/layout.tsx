"use client";

import { useState } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

function LayoutHeaderAndContent({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Unified global URL query theme controller state
  const theme = searchParams.get("theme") === "light" ? "light" : "dark";

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    const params = new URLSearchParams(searchParams.toString());
    params.set("theme", nextTheme);
    router.replace(`?${params.toString()}`);
  };

  return (
    <html
      lang="en"
      className={`${theme === "dark" ? "dark bg-zinc-950 text-zinc-100" : "bg-zinc-50 text-zinc-900"} selection:bg-emerald-500 selection:text-zinc-950 scroll-smooth`}
    >
      <body
        className={`${inter.className} min-h-screen flex flex-col justify-between antialiased bg-zinc-50 dark:bg-zinc-950 transition-colors`}
      >
        <header className="fixed top-0 left-0 right-0 z-[500] bg-white/70 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-900 backdrop-blur-md transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <Link
                href="/"
                className="font-bold tracking-tight text-lg uppercase bg-gradient-to-r from-zinc-900 dark:from-white to-zinc-500 dark:to-zinc-400 bg-clip-text text-transparent"
              >
                Conflict<span className="text-emerald-500">Tracker</span>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              <Link
                href="/tracker"
                className="text-emerald-500 font-bold hover:text-emerald-400 transition-colors"
              >
                Map
              </Link>
              <a
                href="#about"
                className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                About Us
              </a>
              <a
                href="#support"
                className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              >
                Support
              </a>
            </nav>

            <div className="hidden md:flex items-center gap-4">
              {/* Theme Toggle Button integrated elegantly on the right of the desktop navbar */}
              <button
                onClick={toggleTheme}
                type="button"
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center gap-2 shadow-sm"
              >
                {theme === "light" ? "🌙 Dark" : "☀️ Light"}
              </button>
              <span className="text-xs font-mono bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500">
                Region: NG // Live
              </span>
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="inline-flex md:hidden items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors focus:outline-none"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Toggle navigation menu</span>
              {isMobileMenuOpen ? (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>

          {isMobileMenuOpen && (
            <div className="md:hidden bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900 shadow-xl transition-all duration-200">
              <div className="px-4 pt-3 pb-6 space-y-3 font-medium text-sm">
                <Link
                  href="/tracker"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 transition-colors"
                >
                  Map
                </Link>
                <button
                  onClick={() => {
                    toggleTheme();
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left block px-3 py-2.5 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  {theme === "light" ? "🌙 Dark Mode" : "☀️ Light Mode"}
                </button>
                <div className="pt-2 px-3">
                  <span className="inline-block text-[11px] font-mono bg-zinc-100 dark:bg-zinc-900 px-3 py-1.5 rounded-full text-zinc-500 border border-zinc-200 dark:border-zinc-800">
                    Region: NG // Live
                  </span>
                </div>
              </div>
            </div>
          )}
        </header>

        <div className="flex-grow">{children}</div>

        <footer className="bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-900 py-6 text-xs text-zinc-500 font-mono transition-colors">
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-center sm:text-left">
              &copy; {new Date().getFullYear()} Conflict Tracker Nigeria. All
              assets verified.
            </div>
            <div className="flex gap-6 justify-center">
              <a href="#" className="hover:text-emerald-500 transition-colors">
                Data Privacy
              </a>
              <a href="#" className="hover:text-emerald-500 transition-colors">
                API Endpoint
              </a>
              <a href="#" className="hover:text-emerald-500 transition-colors">
                Incident Reporting
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <LayoutHeaderAndContent>{children}</LayoutHeaderAndContent>
    </Suspense>
  );
}

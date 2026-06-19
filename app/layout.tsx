"use client";

import { useState } from "react";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <html
      lang="en"
      className="dark bg-zinc-950 text-zinc-100 selection:bg-emerald-500 selection:text-zinc-950 scroll-smooth"
    >
      <body
        className={`${inter.className} min-h-screen flex flex-col justify-between antialiased`}
      >
        {/* RESPONSIVE BORDERLESS HEADER */}
        <header className="fixed top-0 left-0 right-0 z-[500] bg-zinc-950/70 backdrop-blur-md transition-all duration-300">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <Link
                href="/"
                className="font-bold tracking-tight text-lg uppercase bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent"
              >
                Conflict<span className="text-emerald-500">Tracker</span>
              </Link>
            </div>

            {/* Desktop Navigation Links (Hidden on mobile) */}
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
              <Link
                href="/tracker"
                className="text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Map
              </Link>
              <a
                href="#about"
                className="hover:text-zinc-200 transition-colors"
              >
                About Us
              </a>
              <a
                href="#support"
                className="hover:text-zinc-200 transition-colors"
              >
                Support
              </a>
            </nav>

            {/* Desktop Status Badge (Hidden on mobile) */}
            <div className="hidden md:flex items-center">
              <span className="text-xs font-mono bg-zinc-900 px-3 py-1.5 rounded-full border border-zinc-800 text-zinc-500">
                Region: NG // Live
              </span>
            </div>

            {/* Mobile Hamburger Menu Toggle Button (Visible only on mobile) */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="inline-flex md:hidden items-center justify-center p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors focus:outline-none"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Toggle navigation menu</span>
              {isMobileMenuOpen ? (
                // Close icon (X)
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
                // Open icon (Hamburger lines)
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

          {/* Mobile Overlay Navigation Menu (Toggled via button) */}
          {isMobileMenuOpen && (
            <div className="md:hidden bg-zinc-950 border-t border-zinc-900/60 shadow-xl transition-all duration-200">
              <div className="px-4 pt-3 pb-6 space-y-3 font-medium text-sm">
                <Link
                  href="/tracker"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-emerald-400 bg-emerald-950/20 transition-colors"
                >
                  Map
                </Link>
                <a
                  href="#about"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
                >
                  About Us
                </a>
                <a
                  href="#support"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-xl text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 transition-colors"
                >
                  Support
                </a>
                <div className="pt-2 px-3">
                  <span className="inline-block text-[11px] font-mono bg-zinc-900 px-3 py-1.5 rounded-full text-zinc-500 border border-zinc-800">
                    Region: NG // Live
                  </span>
                </div>
              </div>
            </div>
          )}
        </header>

        {/* MAIN CONTAINER WORKSPACE */}
        <div className="flex-grow">{children}</div>

        {/* SYSTEM FOOTER */}
        <footer className="bg-zinc-950 border-t border-zinc-900 py-6 text-xs text-zinc-500 font-mono">
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

/**
 * /app/api/conflicts/route.ts
 *
 * Design changes vs. original:
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. GeoJSON is fetched and cached at module level (survives across requests
 *    in the same Next.js worker process).  The external URL is only hit once
 *    per cold-start instead of on every API call.
 *
 * 2. State/LGA filtering has been REMOVED from this route.
 *    All filtering now happens client-side in useMemo(), which is instant
 *    and requires no additional network round-trips.  The route returns the
 *    full dataset (already scoped to startYear) every time.
 *
 * 3. The CSV files are read once per request but their cost is now paid
 *    only on the single initial page load — not on every dropdown change.
 *
 * Query params accepted:
 *   startYear  — integer, default 2025.  Rows with year < startYear are
 *                dropped server-side to keep the payload lean.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// ─── Module-level GeoJSON cache ───────────────────────────────────────────────
// Survives across requests in the same worker.  Type-safe minimal shape.

interface Ward {
  latitude: string;
  longitude: string;
}
interface LgaEntry {
  name: string;
  wards: Ward[];
}
interface StateEntry {
  state: string;
  lgas: LgaEntry[];
}

let geoCache: StateEntry[] | null = null;

async function getGeoData(): Promise<StateEntry[]> {
  if (geoCache) return geoCache;

  const res = await fetch(
    "https://temikeezy.github.io/nigeria-geojson-data/data/full.json",
    // Next.js fetch — cache indefinitely until the next deployment.
    { next: { revalidate: 86400 } }
  );
  if (!res.ok) throw new Error(`GeoJSON fetch failed: ${res.status}`);

  geoCache = await res.json();
  return geoCache as StateEntry[];
}

// ─── Coordinate resolver ──────────────────────────────────────────────────────

const NIGERIA_FALLBACK: [number, number] = [9.082, 8.6753];

function resolveCoords(
  geoData: StateEntry[],
  stateName: string,
  lgaName: string
): [number, number] {
  const stateEntry = geoData.find(
    (s) => s.state.toLowerCase().trim() === stateName.toLowerCase().trim()
  );
  if (!stateEntry) return NIGERIA_FALLBACK;

  const lgaEntry = stateEntry.lgas.find(
    (l) => l.name.toLowerCase().trim() === lgaName.toLowerCase().trim()
  );
  if (!lgaEntry || lgaEntry.wards.length === 0) return NIGERIA_FALLBACK;

  const ward = lgaEntry.wards[0];
  const lat = parseFloat(ward.latitude);
  const lng = parseFloat(ward.longitude);

  return isFinite(lat) && isFinite(lng) ? [lat, lng] : NIGERIA_FALLBACK;
}

// ─── CSV processor ────────────────────────────────────────────────────────────

function processCsv(
  filePath: string,
  categoryLabel: string,
  startYear: number,
  geoData: StateEntry[]
) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[conflicts API] Missing data file: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const results = [];

  for (const row of rows) {
    const year = parseInt(row.Year || "0", 10);
    if (year < startYear) continue;

    const incidents = parseInt(row.Events || "0", 10);
    const casualties = parseInt(row.Fatalities || "0", 10);
    // Skip rows with no activity — they bloat the payload for nothing.
    if (incidents === 0 && casualties === 0) continue;

    const state = (row.Admin1 || "").trim();
    const lga = (row.Admin2 || "").trim();
    if (!state || !lga) continue;

    results.push({
      state,
      lga,
      month: row.Month || "",
      year,
      incidentCount: incidents,
      reportedCasualties: casualties,
      alertType: categoryLabel,
      coordinates: resolveCoords(geoData, state, lga),
    });
  }

  return results;
}

// ─── Month sort order ─────────────────────────────────────────────────────────

const MONTH_ORDER: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startYear = parseInt(searchParams.get("startYear") || "2025", 10);

    const geoData = await getGeoData();

    const dataDir = path.join(process.cwd(), "public", "data");

    const merged = [
      ...processCsv(
        path.join(dataDir, "civilian_targeting.csv"),
        "Threats to Civilians",
        startYear,
        geoData
      ),
      ...processCsv(
        path.join(dataDir, "political_violence.csv"),
        "Armed Clashes & Attacks",
        startYear,
        geoData
      ),
    ];

    // Sort: most recent first
    merged.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return (MONTH_ORDER[b.month] ?? 0) - (MONTH_ORDER[a.month] ?? 0);
    });

    return NextResponse.json(merged);
  } catch (err) {
    console.error("[conflicts API] Pipeline failure:", err);
    return NextResponse.json(
      { error: "Failed to read conflict data" },
      { status: 500 }
    );
  }
}

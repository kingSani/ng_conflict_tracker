/**
 * scripts/build-conflict-data.ts
 *
 * Run automatically before `next build` via package.json:
 *   "prebuild": "npx ts-node --project tsconfig.scripts.json scripts/build-conflict-data.ts"
 *
 * What it does:
 *   1. Fetches the Nigeria ward-coordinates GeoJSON (once, at build time)
 *   2. Reads both CSV files from public/data/
 *   3. Resolves coordinates for every row
 *   4. Writes the merged, sorted result to public/data/conflict-data.json
 *
 * The API route then just does JSON.parse(readFileSync(...)) — no parsing,
 * no network calls, sub-millisecond cold path.
 */

import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

// ─── Types ────────────────────────────────────────────────────────────────────

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
interface ConflictRow {
  state: string;
  lga: string;
  month: string;
  year: number;
  incidentCount: number;
  reportedCasualties: number;
  alertType: string;
  eventType?: string;
  subEventType?: string;
  eventDate?: string;
  eventId?: string;
  description?: string;
  coordinates: [number, number];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_URL =
  "https://temikeezy.github.io/nigeria-geojson-data/data/full.json";
const DATA_DIR = path.join(process.cwd(), "public", "data");
const NIGERIA_FALLBACK: [number, number] = [9.082, 8.6753];

const MONTH_ORDER: Record<string, number> = {
  January: 1, February: 2, March: 3, April: 4,
  May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function processCsv(
  filePath: string,
  categoryLabel: string,
  geoData: StateEntry[]
): ConflictRow[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[build] Missing: ${filePath}`);
    return [];
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const results: ConflictRow[] = [];

  for (const row of rows) {
    const year = parseInt(row.Year || "0", 10);
    const incidents = parseInt(row.Events || "0", 10);
    const casualties = parseInt(row.Fatalities || "0", 10);
    const state = (row.Admin1 || "").trim();
    const lga = (row.Admin2 || "").trim();

    if (!state || !lga) continue;
    // Keep all years — the API route filters by startYear at request time.
    // Zero-activity rows are skipped to keep the file lean.
    if (incidents === 0 && casualties === 0) continue;

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


function processAcledCsv(filePath: string): ConflictRow[] {
  if (!fs.existsSync(filePath)) {
    console.warn(`[build] Missing: ${filePath}`);
    return [];
  }

  const rows = parse(fs.readFileSync(filePath, "utf-8"), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
  const results: ConflictRow[] = [];

  for (const row of rows) {
    const state = (row.admin1 || "").trim();
    const lga = (row.admin2 || "").trim();
    const eventType = (row.event_type || "").trim();
    const subEventType = (row.sub_event_type || "").trim();
    const eventDate = (row.event_date || "").trim();
    const year = parseInt(row.year || eventDate.slice(0, 4) || "0", 10);
    const latitude = parseFloat(row.latitude || "");
    const longitude = parseFloat(row.longitude || "");
    if (!state || !lga || !eventType || year < 2021 || !isFinite(latitude) || !isFinite(longitude)) continue;

    const date = new Date(`${eventDate}T00:00:00Z`);
    if (!isFinite(date.getTime())) continue;
    const month = Object.keys(MONTH_ORDER)[date.getUTCMonth()];

    results.push({
      state,
      lga,
      month,
      year,
      incidentCount: 1,
      reportedCasualties: parseInt(row.fatalities || "0", 10) || 0,
      alertType: eventType,
      eventType,
      subEventType,
      eventDate,
      eventId: row.event_id_cnty,
      description: (row.event_description || "").trim(),
      coordinates: [latitude, longitude],
    });
  }

  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("[build-conflict-data] Starting…");

  // 1. Fetch GeoJSON
  console.log("[build-conflict-data] Fetching ward coordinates…");
  const geoRes = await fetch(GEO_URL);
  if (!geoRes.ok) throw new Error(`GeoJSON fetch failed: ${geoRes.status}`);
  const geoData: StateEntry[] = await geoRes.json();
  console.log(`[build-conflict-data] Loaded ${geoData.length} states from GeoJSON`);

  // 2. Process CSVs
  const merged: ConflictRow[] = [
    ...processCsv(
      path.join(DATA_DIR, "civilian_targeting.csv"),
      "Threats to Civilians",
      geoData
    ),
    ...processCsv(
      path.join(DATA_DIR, "political_violence.csv"),
      "Armed Clashes & Attacks",
      geoData
    ),
    ...processAcledCsv(path.join(DATA_DIR, "acled_events.csv")),
  ];

  // 3. Sort: most recent first
  merged.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year;
    return (MONTH_ORDER[b.month] ?? 0) - (MONTH_ORDER[a.month] ?? 0);
  });

  // 4. Write compact year partitions and filter metadata. The API reads only
  // the selected year, avoiding a full-dataset parse on the first request.
  const groupedByYear = new Map<number, ConflictRow[]>();
  for (const row of merged) {
    const yearRows = groupedByYear.get(row.year) ?? [];
    yearRows.push(row);
    groupedByYear.set(row.year, yearRows);
  }

  const recentRows = merged.filter((row) => row.year >= 2021);
  const years = Array.from(new Set(recentRows.map((row) => row.year))).sort((a, b) => b - a);
  const categories = Array.from(new Set(recentRows.map((row) => row.eventType || row.alertType)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const subEventTypeCounts = new Map<string, number>();
  for (const row of recentRows) {
    if (row.subEventType) {
      subEventTypeCounts.set(row.subEventType, (subEventTypeCounts.get(row.subEventType) ?? 0) + row.incidentCount);
    }
  }

  for (const file of fs.readdirSync(DATA_DIR)) {
    if (/^conflict-data(?:-\d{4})?\.json$/.test(file)) fs.unlinkSync(path.join(DATA_DIR, file));
  }
  for (const [year, rows] of groupedByYear) {
    fs.writeFileSync(path.join(DATA_DIR, `conflict-data-${year}.json`), JSON.stringify(rows), "utf-8");
  }
  const metadata = {
    years,
    categories,
    subEventTypeCounts: Object.fromEntries(subEventTypeCounts),
    totalRows: recentRows.length,
  };
  fs.writeFileSync(path.join(DATA_DIR, "conflict-data-meta.json"), JSON.stringify(metadata), "utf-8");

  const totalKb = (fs.readdirSync(DATA_DIR)
    .filter((file) => /^conflict-data(?:-\d{4})?\.json$/.test(file))
    .reduce((total, file) => total + fs.statSync(path.join(DATA_DIR, file)).size, 0) / 1024).toFixed(1);
  console.log(`[build-conflict-data] Done. ${merged.length} rows across ${groupedByYear.size} year files (${totalKb} KB total)`);
}

main().catch((err) => {
  console.error("[build-conflict-data] Failed:", err);
  process.exit(1);
});

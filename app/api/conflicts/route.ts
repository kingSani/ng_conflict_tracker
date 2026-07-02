/**
 * /app/api/conflicts/route.ts
 *
 * Now reads the pre-built conflict-data.json produced by the build script.
 * All CSV parsing and GeoJSON resolution happens at build time — not here.
 * This handler is just: read file → filter by startYear → respond.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
export const dynamic = "force-dynamic";
interface ConflictRow {
  state: string;
  lga: string;
  month: string;
  year: number;
  incidentCount: number;
  reportedCasualties: number;
  alertType: string;
  coordinates: [number, number];
}

const DATA_FILE = path.join(
  process.cwd(),
  "public",
  "data",
  "conflict-data.json",
);

// Module-level cache — survives across requests in the same worker process.
// The file only changes on redeploy so this is always safe.
let cachedData: ConflictRow[] | null = null;

function getAllData(): ConflictRow[] {
  if (cachedData) return cachedData;

  if (!fs.existsSync(DATA_FILE)) {
    throw new Error(
      "conflict-data.json not found. Run `npm run build` (or the prebuild script) first.",
    );
  }

  cachedData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8")) as ConflictRow[];
  return cachedData;
}

const MONTH_ORDER: Record<string, number> = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startYear = parseInt(searchParams.get("startYear") || "2025", 10);

    const all = getAllData();

    // Only year-filter here. State/LGA filtering is done client-side.
    const filtered =
      startYear > 0 ? all.filter((r) => r.year >= startYear) : all;

    filtered.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return (MONTH_ORDER[b.month] ?? 0) - (MONTH_ORDER[a.month] ?? 0);
    });

    return NextResponse.json(filtered);
  } catch (err) {
    console.error("[conflicts API]", err);
    return NextResponse.json(
      { error: "Failed to load conflict data" },
      { status: 500 },
    );
  }
}

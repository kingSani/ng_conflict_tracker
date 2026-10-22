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
  eventType?: string;
  subEventType?: string;
  eventDate?: string;
  eventId?: string;
  description?: string;
  coordinates: [number, number];
}

const DATA_DIR = path.join(process.cwd(), "public", "data");
const METADATA_FILE = path.join(DATA_DIR, "conflict-data-meta.json");
let cachedMetadata: ConflictMetadata | null = null;
const cachedYears = new Map<number, ConflictRow[]>();

interface ConflictMetadata {
  years: number[];
  categories: string[];
  subEventTypeCounts: Record<string, number>;
  totalRows: number;
}

function getMetadata(): ConflictMetadata {
  if (cachedMetadata) return cachedMetadata;
  if (!fs.existsSync(METADATA_FILE)) {
    throw new Error("Conflict metadata not found. Run `npm run data:build` first.");
  }
  cachedMetadata = JSON.parse(fs.readFileSync(METADATA_FILE, "utf-8")) as ConflictMetadata;
  return cachedMetadata;
}

function getYearData(year: number): ConflictRow[] {
  const cached = cachedYears.get(year);
  if (cached) return cached;
  const dataFile = path.join(DATA_DIR, `conflict-data-${year}.json`);
  if (!fs.existsSync(dataFile)) return [];
  const rows = JSON.parse(fs.readFileSync(dataFile, "utf-8")) as ConflictRow[];
  cachedYears.set(year, rows);
  return rows;
}



export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metadata = getMetadata();
    if (searchParams.get("meta") === "1") {
      return NextResponse.json(metadata, {
        headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
      });
    }

    const requestedYear = searchParams.get("year");
    if (requestedYear && !/^\d{4}$/.test(requestedYear)) {
      return NextResponse.json({ error: "Invalid year" }, { status: 400 });
    }
    const startYear = Number.parseInt(searchParams.get("startYear") || "2021", 10);
    const years = requestedYear
      ? [Number.parseInt(requestedYear, 10)]
      : metadata.years.filter((year) => startYear <= 0 || year >= startYear);
    const filtered = years.flatMap(getYearData);

    const requestedLimit = Number.parseInt(searchParams.get("limit") || "0", 10);
    const result = requestedLimit > 0 ? filtered.slice(0, requestedLimit) : filtered;
    return NextResponse.json(result, {
      headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=3600" },
    });
  } catch (err) {
    console.error("[conflicts API]", err);
    return NextResponse.json(
      { error: "Failed to load conflict data" },
      { status: 500 },
    );
  }
}
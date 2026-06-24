import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state") || "";
    const lga = searchParams.get("lga") || "";
    const startYear = parseInt(searchParams.get("startYear") || "2025");

    // Fetch the exhaustive ward coordinates JSON matrix
    const geoJsonRes = await fetch(
      "https://temikeezy.github.io/nigeria-geojson-data/data/full.json",
    );
    const geoData = await geoJsonRes.json();

    const dataDir = path.join(process.cwd(), "public", "data");
    const civilianPath = path.join(dataDir, "civilian_targeting.csv");
    const politicalPath = path.join(dataDir, "political_violence.csv");

    const processCsvFile = (filePath: string, friendlyCategoryName: string) => {
      if (!fs.existsSync(filePath)) {
        console.warn(`Data file checkpoint missing: ${filePath}`);
        return [];
      }

      const rawContent = fs.readFileSync(filePath, "utf-8");
      const rows = parse(rawContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      return rows
        .map((row: any) => {
          const rowState = row.Admin1 || "";
          const rowLga = row.Admin2 || "";

          // Spatial Matching: Look into the GeoJSON Ward dictionary
          const matchedStateObj = geoData.find(
            (s: any) =>
              s.state.toLowerCase().trim() === rowState.toLowerCase().trim(),
          );

          const matchedLgaObj = matchedStateObj?.lgas.find(
            (l: any) =>
              l.name.toLowerCase().trim() === rowLga.toLowerCase().trim(),
          );

          // Select an active ward or fall back smoothly to another point within the same LGA boundary area
          const targetWard = matchedLgaObj?.wards[0];
          const latitude = targetWard?.latitude
            ? parseFloat(targetWard.latitude)
            : 9.082;
          const longitude = targetWard?.longitude
            ? parseFloat(targetWard.longitude)
            : 8.6753;

          return {
            state: rowState,
            lga: rowLga,
            month: row.Month,
            year: parseInt(row.Year || "0"),
            reportedCasualties: parseInt(row.Fatalities || "0"),
            incidentCount: parseInt(row.Events || "0"),
            alertType: friendlyCategoryName,
            // Dynamic coordinates map straight to the specific local sub-area matrix
            coordinates: [latitude, longitude] as [number, number],
          };
        })
        .filter((row) => {
          if (!row.state || !row.lga) return false;
          if (row.year < startYear) return false;

          const cleanSearchState = state
            .toLowerCase()
            .trim()
            .replace(/federal capital territory/g, "fct")
            .replace(/ss/g, "s");
          const cleanRowState = row.state
            .toLowerCase()
            .trim()
            .replace(/federal capital territory/g, "fct")
            .replace(/ss/g, "s");

          if (
            state &&
            !cleanRowState.includes(cleanSearchState) &&
            !cleanSearchState.includes(cleanRowState)
          ) {
            return false;
          }

          if (lga) {
            const cleanSearchLga = lga
              .toLowerCase()
              .replace(/[-\s]/g, "")
              .replace(/ss/g, "s");
            const cleanRowLga = row.lga
              .toLowerCase()
              .replace(/[-\s]/g, "")
              .replace(/ss/g, "s");
            if (
              !cleanRowLga.includes(cleanSearchLga) &&
              !cleanSearchLga.includes(cleanRowLga)
            ) {
              return false;
            }
          }

          return row.incidentCount > 0 || row.reportedCasualties > 0;
        });
    };

    const mergedData = [
      ...processCsvFile(civilianPath, "Threats to Civilians"),
      ...processCsvFile(politicalPath, "Armed Clashes & Attacks"),
    ];

    const monthOrder: Record<string, number> = {
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

    mergedData.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return (monthOrder[b.month] || 0) - (monthOrder[a.month] || 0);
    });

    return NextResponse.json(mergedData);
  } catch (error) {
    console.error("Pipeline failure parsing CSV arrays:", error);
    return NextResponse.json(
      { error: "Failed to read data files" },
      { status: 500 },
    );
  }
}

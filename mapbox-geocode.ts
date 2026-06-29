/**
 * lib/mapbox-geocode.ts
 *
 * Thin wrapper around the Mapbox Geocoding API.
 * Requires NEXT_PUBLIC_MAPBOX_TOKEN in your .env.local
 *
 * Why Mapbox over Nominatim:
 *  - No rate-limit headaches (50k free requests/month)
 *  - More accurate for Nigerian LGA names
 *  - Consistent JSON shape, well-documented
 *  - Supports country-scoping (&country=ng) natively
 *
 * Usage:
 *   import { reverseGeocode } from "@/lib/mapbox-geocode";
 *   const result = await reverseGeocode(lat, lng);
 *   // → { state: "Rivers", lga: "Obio-Akpor" } | null
 */

const BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeocodeResult {
  /** State name, stripped of trailing " State" — matches ACLED Admin1 convention */
  state: string;
  /** LGA / district name — matches ACLED Admin2 as closely as Mapbox allows */
  lga: string;
  /** Full human-readable place name returned by Mapbox */
  placeName: string;
}

// Mapbox feature context entry
interface MbContext {
  id: string;
  text: string;
  short_code?: string;
}

interface MbFeature {
  place_name: string;
  context?: MbContext[];
  text: string;
}

interface MbResponse {
  features: MbFeature[];
}

// ─── Token guard ──────────────────────────────────────────────────────────────

function getToken(): string {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_MAPBOX_TOKEN is not set. Add it to .env.local"
    );
  }
  return token;
}

// ─── Reverse geocode (coordinates → state + LGA) ──────────────────────────────

/**
 * Convert a lat/lng to { state, lga }.
 * Returns null if outside Nigeria or the request fails.
 *
 * Mapbox context hierarchy for Nigeria (innermost → outermost):
 *   locality → place (≈ LGA) → district → region (≈ State) → country
 *
 * We extract `region` for state and `place` or `district` for LGA,
 * since Mapbox doesn't have a dedicated "LGA" type.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  try {
    const token = getToken();
    // types=place,district,region limits the response to admin levels we care about
    const url =
      `${BASE}/${lng},${lat}.json` +
      `?country=ng` +
      `&types=place,district,region` +
      `&language=en` +
      `&access_token=${token}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data: MbResponse = await res.json();
    if (!data.features || data.features.length === 0) return null;

    const feature = data.features[0];
    const context = feature.context ?? [];

    // Pull region (state) from context
    const regionCtx = context.find((c) => c.id.startsWith("region."));
    const districtCtx =
      context.find((c) => c.id.startsWith("place.")) ||
      context.find((c) => c.id.startsWith("district."));

    const rawState = regionCtx?.text ?? "";
    const rawLga = districtCtx?.text ?? feature.text ?? "";

    const state = rawState.replace(/\s*State$/i, "").trim();
    const lga = rawLga.trim();

    if (!state) return null;

    return {
      state,
      lga,
      placeName: feature.place_name,
    };
  } catch (err) {
    console.error("[mapbox-geocode] reverseGeocode error:", err);
    return null;
  }
}

// ─── Forward geocode (place name → coordinates) ───────────────────────────────

/**
 * Convert a place / LGA name to coordinates.
 * Useful if you ever want to search by name rather than clicking the map.
 *
 * Returns [lng, lat] (Mapbox order) or null.
 */
export async function forwardGeocode(
  query: string
): Promise<[number, number] | null> {
  try {
    const token = getToken();
    const encoded = encodeURIComponent(query);
    const url =
      `${BASE}/${encoded}.json` +
      `?country=ng` +
      `&language=en` +
      `&limit=1` +
      `&access_token=${token}`;

    const res = await fetch(url);
    if (!res.ok) return null;

    const data: MbResponse = await res.json();
    if (!data.features || data.features.length === 0) return null;

    // Mapbox returns [longitude, latitude]
    const coords = (data.features[0] as any).center as [number, number];
    return coords ?? null;
  } catch (err) {
    console.error("[mapbox-geocode] forwardGeocode error:", err);
    return null;
  }
}

import { State } from "country-state-city";

/** Static JSON data published by Temi Kolawole's Nigeria GeoJSON project. */
export const NIGERIA_GEO_DATA_BASE = "https://temikeezy.github.io/nigeria-geojson-data/data";

export interface NigeriaStateOption {
  /** Canonical state name used by the tracker and ACLED records. */
  name: string;
  /** ISO-like code retained for existing tracker URLs. */
  isoCode: string;
  /** Exact key used in the upstream lgas.json object. */
  sourceName: string;
}

export interface NigeriaGeoData {
  states: NigeriaStateOption[];
  lgasByState: Record<string, string[]>;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\s*state$/i, "").replace(/[^a-z]/g, "").replace(/ss/g, "s");
}

let cachedGeoData: Promise<NigeriaGeoData> | null = null;

/** Fetch and validate the upstream state and LGA lists once per browser session. */
export function getNigeriaGeoData(): Promise<NigeriaGeoData> {
  if (!cachedGeoData) {
    cachedGeoData = Promise.all([
      fetch(`${NIGERIA_GEO_DATA_BASE}/states.json`).then((response) => {
        if (!response.ok) throw new Error(`Nigeria states data request failed (${response.status})`);
        return response.json() as Promise<unknown>;
      }),
      fetch(`${NIGERIA_GEO_DATA_BASE}/lgas.json`).then((response) => {
        if (!response.ok) throw new Error(`Nigeria LGAs data request failed (${response.status})`);
        return response.json() as Promise<unknown>;
      }),
    ]).then(([rawStates, rawLgas]) => {
      if (!Array.isArray(rawStates) || !rawStates.every((item) => typeof item === "string")) {
        throw new Error("Nigeria Geo API returned an invalid states list");
      }
      if (!rawLgas || typeof rawLgas !== "object" || Array.isArray(rawLgas)) {
        throw new Error("Nigeria Geo API returned an invalid LGA map");
      }

      const lgasByState = rawLgas as Record<string, unknown>;
      const localStates = State.getStatesOfCountry("NG");
      const states = (rawStates as string[]).map((sourceName) => {
        const knownState = localStates.find((state) => normalizeName(state.name) === normalizeName(sourceName));
        return {
          name: knownState?.name.replace(/\s*State$/i, "") ?? sourceName,
          isoCode: knownState?.isoCode ?? sourceName,
          sourceName,
        };
      });

      for (const state of states) {
        const stateLgas: unknown = lgasByState[state.sourceName];
        if (!Array.isArray(stateLgas) || !stateLgas.every((item: unknown) => typeof item === "string")) {
          throw new Error(`Nigeria Geo API returned an invalid LGA list for ${state.sourceName}`);
        }
      }

      return { states, lgasByState: lgasByState as Record<string, string[]> };
    }).catch((error) => {
      cachedGeoData = null;
      throw error;
    });
  }
  return cachedGeoData;
}

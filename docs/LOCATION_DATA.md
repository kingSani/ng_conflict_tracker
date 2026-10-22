# Location data integration

## Provider

The location selectors use [Temi Kolawole's Nigeria GeoJSON dataset](https://github.com/temikeezy/nigeria-geojson-data), published as static JSON at [temikeezy.github.io/nigeria-geojson-data](https://temikeezy.github.io/nigeria-geojson-data/). The upstream project documents a list of Nigerian states, a state-to-LGA mapping, and additional ward datasets under an MIT license.

The tracker currently reads these resources:

| Resource | Purpose | Shape |
| --- | --- | --- |
| `data/states.json` | Landing and tracker state selectors | Array of state-name strings |
| `data/lgas.json` | LGA selector and map reverse-geocode matching | Object mapping state names to arrays of LGA-name strings |

The app fetches the JSON from GitHub Pages in the browser. A small adapter in `app/lib/nigeria-geo.ts` validates the response, caches the in-flight data request for the browser session, and maps source state names to the legacy ISO-like codes used in tracker URLs. The user-visible state and LGA names come from the upstream dataset.

## Reverse geocoding boundary

The dataset is a collection of static administrative lists; it does not provide a reverse-geocoding endpoint for arbitrary map coordinates. The tracker therefore continues to use Mapbox to turn a map click into a candidate state and LGA, then matches those names against the Temi Kolawole state/LGA data. A Mapbox public token is required for that map-click feature.

## Updating or troubleshooting

1. Confirm the upstream JSON file names and response shapes in the provider repository before changing the adapter.
2. Keep `states.json` and `lgas.json` state names aligned. The adapter validates that each listed state has an LGA array.
3. If the upstream static host is unavailable or its schema changes, the selectors display a location-data load message; check the provider repository and the browser network console.
4. If a new state spelling no longer maps to an existing tracker code, update the adapter's name normalization or state-code mapping while preserving the human-readable source name used for the LGA key.

## Attribution and license

Source project: [temikeezy/nigeria-geojson-data](https://github.com/temikeezy/nigeria-geojson-data). The upstream repository states that its data is distributed under the MIT License and that attribution is appreciated. Review the upstream license and retain attribution when redistributing any copied or modified dataset files.

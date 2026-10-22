# NG Conflict Tracker

An interactive Nigeria conflict event tracker with state and LGA filters, map-based exploration, event narratives, incident summaries, and light/dark themes.

## Features

- Explore reported conflict incidents on an interactive map.
- Filter by state, local government area, ACLED event type and subtype, year, and month.
- Select an event to view its ACLED narrative note when one is available.
- View monthly conflict summaries, including the available 2026 records.
- Use the landing page to open the tracker for a selected location.

## Requirements

- Node.js compatible with the installed Next.js version.
- npm.
- A Mapbox public token for reverse geocoding map clicks.

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create `.env.local` in the repository root and add:

```dotenv
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
```

The token is used by the existing Mapbox reverse-geocoding helper. Do not commit real credentials.

## Useful commands

```bash
npm run dev       # Start the development server
npm run lint      # Run ESLint
npm run build     # Build conflict data, then create a production build
npm run start     # Serve the production build
```

The build's `prebuild` step runs `scripts/build-conflict-data.ts` to generate the conflict dataset consumed by the app. Keep the source data files required by that script in place before building.

## Data sources

- **Administrative location lists:** [Temi Kolawole's Nigeria GeoJSON dataset](https://github.com/temikeezy/nigeria-geojson-data), served as static JSON through [GitHub Pages](https://temikeezy.github.io/nigeria-geojson-data/). The app reads `data/states.json` and `data/lgas.json` for its state and LGA selectors. See [Location data integration](docs/LOCATION_DATA.md).
- **Map-click reverse geocoding:** Mapbox Geocoding API, configured with `NEXT_PUBLIC_MAPBOX_TOKEN`. The Nigeria GeoJSON project publishes static administrative data; it does not expose a coordinate-to-state/LGA reverse-geocoding endpoint.
- **Conflict records:** the supplied ACLED event data and monthly summary files processed by the project data builder. Event narratives are available only where the source event records include notes.

Use the About page's attribution for the project creator. Retain upstream data attribution and licensing information when redistributing the source dataset or its derivatives.

## Deployment

Deploy as a Next.js application on a platform that supports the app's API routes and build command. Add `NEXT_PUBLIC_MAPBOX_TOKEN` to the deployment environment. Confirm the conflict source files are available at build time because the prebuild script generates the public conflict data.

## Maintainer

Created by **Ahmed G. Sani**.

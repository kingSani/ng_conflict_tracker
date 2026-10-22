# Conflict data build and API

## Build outputs

Run `npm run data:build` to fetch ward coordinates, process the conflict CSV sources, and write:

- `public/data/conflict-data-<year>.json` — sorted records for one year.
- `public/data/conflict-data-meta.json` — year, category, subtype-count, and total-row metadata.

`npm run dev` runs the data builder before starting if needed; `npm run build` runs it before a production build. Keep the source CSV files required by `scripts/build-conflict-data.ts` in place.

## API requests

- `GET /api/conflicts?meta=1` returns the compact filter metadata.
- `GET /api/conflicts?year=2026` returns one year's records.
- `GET /api/conflicts?startYear=2021` returns all records from that year onward. The UI uses this only when **All Years** is selected.
- `GET /api/conflicts?year=2026&limit=3` returns the three newest rows used by the landing-page preview.

The tracker defaults to the latest year in its initial selection (currently 2026). It fetches only that year's rows for the map. Selecting another year replaces that request, and the metadata keeps all years and ACLED subtypes available without downloading all event rows up front.

For the 22 October 2026 source snapshot, the full 2021–2026 dataset contains 39,899 rows (about 14.1 MB as JSON). The 2026 partition contains 3,549 rows (about 637 KB as JSON, about 65 KB when gzip-compressed). These sizes change when the source data changes.
# Subway in Motion

![Subway in Motion — a blue A train line on a near-black field](./public/brand/subway-in-motion.svg)

A minimal, animated view of New York City’s subway network following the MTA’s published static schedule. It is designed as a visual spectacle: original city cartography, recognizable landmarks, restrained route color, and scheduled trains moving through the network in New York time.

This is not a live train tracker and is not an official MTA map or application.

## What it includes

- Original Canvas cartography with Manhattan detail, major outer-borough streets, parks, landmarks, and a Staten Island inset.
- Schedule-modeled train positions generated from MTA static GTFS stop times and shapes.
- Sidebar route-family filters for isolating one colored service group at a time.
- Light and dark appearances that default to the user’s device setting without a first-paint theme flash.
- Pointer, keyboard, wheel, and trackpad navigation through 500% zoom.
- Reduced-motion minute snapshots, responsive layouts, and high-density Canvas rendering.
- Build-time Open Graph and Twitter cards plus a hand-authored SVG app icon.

## Local development

This repository uses pnpm.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Run the release checks with:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Schedule data

The committed production bundle currently uses MTA feed version `20260807-H-rockaways-extension-removed`, covering May 26 through October 31, 2026. The source of truth is [`public/data/subway/manifest.json`](./public/data/subway/manifest.json).

No external database, API key, or runtime data service is required. The browser loads the generated, content-hashed map and schedule chunks from [`public/data/subway`](./public/data/subway).

The regular MTA subway GTFS represents the normal schedule and does not include most temporary service changes. Before deploying outside the manifest’s coverage window—or when a new MTA timetable becomes effective—download a fresh static GTFS snapshot and rebuild the bundle:

```bash
MTA_GTFS_DIRECTORY=/path/to/google_transit \
NYC_BOROUGHS_FILE=/path/to/boroughs.geojson \
NYC_MAJOR_STREETS_FILE=/path/to/major-streets.geojson \
NYC_MANHATTAN_STREETS_FILE=/path/to/manhattan-streets.geojson \
NYC_PARKS_FILE=/path/to/parks.geojson \
pnpm data:build
```

See [`data/subway/README.md`](./data/subway/README.md) for source requirements and reproducibility details.

## Deployment

The application can be deployed as a standard Next.js app. On Vercel, production and preview domains are detected automatically. For another host, set `NEXT_PUBLIC_SITE_URL` to the public origin so social metadata resolves to absolute URLs.

The generated schedule bundle is valid for an immediate release on August 10, 2026. Refresh it before October 31, 2026 if the application needs to remain current beyond that timetable.

## Data and identity

Schedule data comes from [MTA Developer Resources](https://www.mta.info/developers). Geography is derived from NYC open-data borough, street-centerline, and functional-parkland datasets. Every source file is hashed in the generated manifest.

The interface and cartography are original, but MTA subway route indicators—including the blue A-train roundel used in the app icon and social card—are MTA intellectual property. A public release that retains those indicators should follow the [MTA Licensing Program](https://www.mta.info/doing-business-with-us/licensing-program). Replace the roundel with an original mark if licensing is not desired.

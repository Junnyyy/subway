# Subway data pipeline

The production visualization is generated from an official MTA static subway
GTFS snapshot and original cartography derived from NYC borough, street, and
park datasets. Raw source files are intentionally not committed.

## Required inputs

- An extracted MTA subway GTFS directory containing `feed_info.txt`,
  `calendar.txt`, `calendar_dates.txt`, `routes.txt`, `trips.txt`,
  `stop_times.txt`, `stops.txt`, and `shapes.txt`.
- NYC Borough Boundaries GeoJSON.
- NYC Street Centerline GeoJSON filtered to major streets.
- NYC Street Centerline GeoJSON for Manhattan local streets.
- NYC Functional Parkland GeoJSON.

## Generate production assets

```sh
MTA_GTFS_DIRECTORY=/path/to/google_transit \
NYC_BOROUGHS_FILE=/path/to/boroughs.geojson \
NYC_MAJOR_STREETS_FILE=/path/to/major-streets.geojson \
NYC_MANHATTAN_STREETS_FILE=/path/to/manhattan-streets.geojson \
NYC_PARKS_FILE=/path/to/parks.geojson \
npm run data:build
```

The generator writes content-hashed map and schedule chunks to
`public/data/subway` and updates the small unversioned `manifest.json` last.
Every source file is hashed into the manifest so a release can be reproduced
from the same inputs.

The visualization must remain labeled as scheduled or modeled. It is original
cartography and is not an official MTA map.

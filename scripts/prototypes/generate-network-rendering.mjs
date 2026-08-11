import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { readCsv, streamCsv } from "../subway/csv.mjs";
import {
  allCoordinates,
  cumulativeDistances,
  simplify,
} from "../subway/geometry.mjs";

const VIEWBOX = { width: 1200, height: 820, padding: 34 };
const ROTATION = (-29 * Math.PI) / 180;
const REFERENCE_LATITUDE = (40.7 * Math.PI) / 180;
const DETAIL_TOLERANCE = 0.06;

const gtfsDirectory = resolve(
  process.env.MTA_GTFS_DIRECTORY ?? "/tmp/subway-gtfs-production",
);
const boroughsFile = resolve(
  process.env.NYC_BOROUGHS_FILE ?? "/tmp/nyc-boroughs.geojson",
);
const manifestFile = resolve("public/data/subway/manifest.json");
const outputFile = resolve(
  "public/data/prototypes/network-rendering.json",
);

function rawPoint([longitude, latitude]) {
  const x = longitude * Math.cos(REFERENCE_LATITUDE) * 111_320;
  const y = -latitude * 110_540;
  return {
    x: x * Math.cos(ROTATION) - y * Math.sin(ROTATION),
    y: x * Math.sin(ROTATION) + y * Math.cos(ROTATION),
  };
}

function boundsFor(points) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function projectorFor(bounds, frame) {
  const scale = Math.min(
    (frame.width - frame.padding * 2) / (bounds.maxX - bounds.minX),
    (frame.height - frame.padding * 2) / (bounds.maxY - bounds.minY),
  );
  const contentWidth = (bounds.maxX - bounds.minX) * scale;
  const contentHeight = (bounds.maxY - bounds.minY) * scale;
  const originX = (frame.width - contentWidth) / 2;
  const originY = (frame.height - contentHeight) / 2;

  return (coordinate) => {
    const point = rawPoint(coordinate);
    return {
      x: originX + (point.x - bounds.minX) * scale,
      y: originY + (point.y - bounds.minY) * scale,
    };
  };
}

function flattenPoints(points) {
  return points.flatMap((point) => [
    Number(point.x.toFixed(2)),
    Number(point.y.toFixed(2)),
  ]);
}

const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
const routeIds = new Set(
  manifest.routeFamilies
    .filter((family) => !family.routeIds.includes("SI"))
    .flatMap((family) => family.routeIds),
);
const boroughs = JSON.parse(readFileSync(boroughsFile, "utf8"));
const mainBounds = boundsFor(
  boroughs.features
    .filter((feature) => feature.properties.boroname !== "Staten Island")
    .flatMap((feature) =>
      allCoordinates(feature.geometry).map(rawPoint),
    ),
);
const project = projectorFor(mainBounds, VIEWBOX);

const trips = readCsv(resolve(gtfsDirectory, "trips.txt"));
const routeForShape = new Map();
for (const trip of trips) {
  if (routeIds.has(trip.route_id) && !routeForShape.has(trip.shape_id)) {
    routeForShape.set(trip.shape_id, trip.route_id);
  }
}

const rawShapes = new Map();
for await (const point of streamCsv(resolve(gtfsDirectory, "shapes.txt"))) {
  if (!routeForShape.has(point.shape_id)) continue;
  const points = rawShapes.get(point.shape_id) ?? [];
  points.push([Number(point.shape_pt_lon), Number(point.shape_pt_lat)]);
  rawShapes.set(point.shape_id, points);
}

const shapes = [];
for (const [id, coordinates] of rawShapes) {
  const routeId = routeForShape.get(id);
  const projected = simplify(coordinates.map(project), DETAIL_TOLERANCE);
  const distances = cumulativeDistances(projected);
  shapes.push({
    id,
    routeId,
    points: flattenPoints(projected),
    length: Number((distances.at(-1) ?? 0).toFixed(2)),
  });
}

const artifact = {
  schemaVersion: 1,
  feedVersion: manifest.feed.version,
  tolerance: DETAIL_TOLERANCE,
  viewBox: [VIEWBOX.width, VIEWBOX.height],
  shapes,
};

writeFileSync(outputFile, `${JSON.stringify(artifact)}\n`);

const pointCount = shapes.reduce(
  (total, shape) => total + shape.points.length / 2,
  0,
);
console.log(
  `Wrote ${shapes.length} shapes and ${pointCount} detailed points to ${outputFile}.`,
);

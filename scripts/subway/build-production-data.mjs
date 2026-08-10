import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, resolve } from "node:path";
import { parseGtfsTime } from "../../lib/subway/schedule.ts";
import { readCsv, streamCsv } from "./csv.mjs";
import {
  allCoordinates,
  centroid,
  cumulativeDistances,
  lineStrings,
  pathFromLines,
  polygonArea,
  polygonRings,
  projectPointToLine,
  simplify,
} from "./geometry.mjs";

const VIEWBOX = { width: 1200, height: 820, padding: 34 };
const ROTATION = (-29 * Math.PI) / 180;
const REFERENCE_LATITUDE = (40.7 * Math.PI) / 180;
const INSET = { x: 28, y: 626, width: 236, height: 154, padding: 13 };

const landmarkDefinitions = [
  { id: "127", label: "Times Sq–42 St", dx: -11, dy: -7, anchor: "end" },
  { id: "631", label: "Grand Central–42 St", dx: 12, dy: -4, anchor: "start" },
  { id: "D17", label: "34 St–Herald Sq", dx: -11, dy: 7, anchor: "end" },
  { id: "635", label: "14 St–Union Sq", dx: 12, dy: 10, anchor: "start" },
  { id: "A38", label: "Fulton St", dx: -11, dy: 11, anchor: "end" },
  { id: "D24", label: "Atlantic Av–Barclays", dx: 12, dy: 11, anchor: "start" },
  { id: "G22", label: "Court Sq", dx: 12, dy: -8, anchor: "start" },
  { id: "G14", label: "Jackson Hts–Roosevelt Av", dx: 12, dy: -7, anchor: "start" },
  { id: "G05", label: "Jamaica Center", dx: 12, dy: -7, anchor: "start" },
  { id: "D43", label: "Coney Island–Stillwell Av", dx: 12, dy: 11, anchor: "start" },
  { id: "A24", label: "Columbus Circle", dx: -12, dy: -7, anchor: "end" },
  { id: "117", label: "116 St–Columbia University", dx: -12, dy: 10, anchor: "end" },
  { id: "A15", label: "125 St", dx: -12, dy: -7, anchor: "end" },
  { id: "414", label: "Yankee Stadium", dx: 12, dy: -7, anchor: "start" },
  { id: "A32", label: "W 4 St–NYU", dx: -12, dy: 11, anchor: "end" },
  { id: "E01", label: "World Trade Center", dx: 14, dy: 15, anchor: "start" },
  { id: "A41", label: "Jay St–MetroTech", dx: -12, dy: 11, anchor: "end" },
  { id: "A51", label: "Broadway Junction", dx: 12, dy: -7, anchor: "start" },
  { id: "701", label: "Flushing–Main St", dx: 12, dy: -7, anchor: "start" },
];

function requiredPath(name, fallback) {
  const value = process.env[name] ?? fallback;
  const path = resolve(value);
  if (!existsSync(path)) {
    throw new Error(`Missing ${name}: ${path}`);
  }
  return path;
}

const source = {
  gtfs: requiredPath("MTA_GTFS_DIRECTORY", "/tmp/subway-gtfs-production"),
  boroughs: requiredPath("NYC_BOROUGHS_FILE", "/tmp/nyc-boroughs.geojson"),
  majorStreets: requiredPath(
    "NYC_MAJOR_STREETS_FILE",
    "/tmp/nyc-major-streets.geojson",
  ),
  manhattanStreets: requiredPath(
    "NYC_MANHATTAN_STREETS_FILE",
    "/tmp/nyc-manhattan-streets.geojson",
  ),
  parks: requiredPath("NYC_PARKS_FILE", "/tmp/nyc-parks-named.geojson"),
};
const outputDirectory = resolve(
  process.env.SUBWAY_DATA_OUTPUT ?? "public/data/subway",
);

function gtfsFile(name) {
  const path = resolve(source.gtfs, name);
  if (!existsSync(path)) throw new Error(`Missing GTFS file: ${path}`);
  return path;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function writeHashedJson(prefix, value) {
  const json = `${JSON.stringify(value)}\n`;
  const hash = createHash("sha256").update(json).digest("hex").slice(0, 12);
  const filename = `${prefix}.${hash}.json`;
  writeFileSync(resolve(outputDirectory, filename), json);
  return `/data/subway/${filename}`;
}

function rawPoint([longitude, latitude]) {
  const x = longitude * Math.cos(REFERENCE_LATITUDE) * 111_320;
  const y = -latitude * 110_540;
  return {
    x: x * Math.cos(ROTATION) - y * Math.sin(ROTATION),
    y: x * Math.sin(ROTATION) + y * Math.cos(ROTATION),
  };
}

function isStatenIslandCoordinate(coordinate) {
  return coordinate?.[0] < -74.05 && coordinate?.[1] < 40.66;
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
  const originX = (frame.x ?? 0) + (frame.width - contentWidth) / 2;
  const originY = (frame.y ?? 0) + (frame.height - contentHeight) / 2;

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

function safeSlug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function weekdaysFor(record) {
  const fields = [
    "sunday",
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
  ];
  return fields.flatMap((field, index) => (record[field] === "1" ? [index] : []));
}

function groupRouteFamilies(routes) {
  const groups = new Map();
  for (const route of routes) {
    const key = `${route.color}-${route.textColor}`;
    const group = groups.get(key) ?? {
      color: route.color,
      textColor: route.textColor,
      labels: [],
      routeIds: [],
      sortOrder: route.sortOrder,
    };
    if (!group.labels.includes(route.label)) group.labels.push(route.label);
    group.routeIds.push(route.id);
    group.sortOrder = Math.min(group.sortOrder, route.sortOrder);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

async function build() {
  mkdirSync(outputDirectory, { recursive: true });

  const boroughGeoJson = readJson(source.boroughs);
  const majorStreetGeoJson = readJson(source.majorStreets);
  const manhattanStreetGeoJson = readJson(source.manhattanStreets);
  const parkGeoJson = readJson(source.parks);

  const mainBoroughFeatures = boroughGeoJson.features.filter(
    (feature) => feature.properties.boroname !== "Staten Island",
  );
  const statenIslandFeature = boroughGeoJson.features.find(
    (feature) => feature.properties.boroname === "Staten Island",
  );
  if (!statenIslandFeature) throw new Error("Staten Island geometry is missing");

  const mainBounds = boundsFor(
    mainBoroughFeatures.flatMap((feature) =>
      allCoordinates(feature.geometry).map(rawPoint),
    ),
  );
  const statenBounds = boundsFor(
    allCoordinates(statenIslandFeature.geometry).map(rawPoint),
  );
  const projectMain = projectorFor(mainBounds, VIEWBOX);
  const projectStaten = projectorFor(statenBounds, INSET);

  const boroughs = mainBoroughFeatures.map((feature) => {
    const rings = polygonRings(feature.geometry);
    const largest = rings
      .map((ring) => ring.map(projectMain))
      .sort((a, b) => polygonArea(b) - polygonArea(a))[0];
    const label = centroid(largest);
    return {
      id: feature.properties.boroname.toLowerCase().replaceAll(" ", "-"),
      name: feature.properties.boroname,
      path: pathFromLines(rings, projectMain, 0.65, true),
      label: { x: Number(label.x.toFixed(1)), y: Number(label.y.toFixed(1)) },
    };
  });

  const arterialLines = [];
  const statenArterialLines = [];
  for (const feature of majorStreetGeoJson.features) {
    if (feature.properties.carto_display_level !== "10") continue;
    for (const line of lineStrings(feature.geometry)) {
      const middle = line[Math.floor(line.length / 2)];
      if (isStatenIslandCoordinate(middle)) {
        statenArterialLines.push(line);
      } else {
        arterialLines.push(line);
      }
    }
  }
  const manhattanLocalLines = manhattanStreetGeoJson.features
    .filter((feature) => !feature.properties.carto_display_level)
    .flatMap((feature) => lineStrings(feature.geometry));

  const parkRings = [];
  for (const feature of parkGeoJson.features) {
    for (const ring of polygonRings(feature.geometry)) {
      const middle = ring[Math.floor(ring.length / 2)];
      if (isStatenIslandCoordinate(middle)) continue;
      if (polygonArea(ring.map(projectMain)) > 2.2) parkRings.push(ring);
    }
  }

  const routeRows = readCsv(gtfsFile("routes.txt"));
  const routes = routeRows
    .map((route) => ({
      id: route.route_id,
      label: route.route_short_name.replace(/X$/, ""),
      name: route.route_long_name,
      color: `#${route.route_color || "7C858C"}`,
      textColor: `#${route.route_text_color || "FFFFFF"}`,
      sortOrder: Number(route.route_sort_order || 999),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const routeById = new Map(routes.map((route) => [route.id, route]));

  const tripRows = readCsv(gtfsFile("trips.txt"));
  const tripById = new Map(tripRows.map((trip) => [trip.trip_id, trip]));
  const routeForShape = new Map();
  for (const trip of tripRows) {
    if (!routeForShape.has(trip.shape_id)) {
      routeForShape.set(trip.shape_id, trip.route_id);
    }
  }

  const rawShapes = new Map();
  for await (const point of streamCsv(gtfsFile("shapes.txt"))) {
    const points = rawShapes.get(point.shape_id) ?? [];
    points.push([Number(point.shape_pt_lon), Number(point.shape_pt_lat)]);
    rawShapes.set(point.shape_id, points);
  }

  const shapes = [];
  const runtimeShapes = [];
  const shapeIndexById = new Map();
  for (const [shapeId, coordinates] of rawShapes) {
    const routeId = routeForShape.get(shapeId);
    if (!routeId || !routeById.has(routeId)) continue;
    const project = routeId === "SI" ? projectStaten : projectMain;
    const tolerance = routeId === "SI" ? 0.18 : 0.24;
    const projected = simplify(coordinates.map(project), tolerance).map((point) => ({
      x: Number(point.x.toFixed(2)),
      y: Number(point.y.toFixed(2)),
    }));
    const distances = cumulativeDistances(projected).map((distance) =>
      Number(distance.toFixed(2)),
    );
    shapeIndexById.set(shapeId, shapes.length);
    shapes.push({
      id: shapeId,
      routeId,
      points: flattenPoints(projected),
      distances,
    });
    runtimeShapes.push({ points: projected, distances });
  }

  const stopRows = readCsv(gtfsFile("stops.txt"));
  const stopById = new Map(stopRows.map((stop) => [stop.stop_id, stop]));
  const parentStations = stopRows.filter(
    (stop) => stop.location_type === "1" && stop.stop_lat && stop.stop_lon,
  );
  const parentById = new Map(parentStations.map((station) => [station.stop_id, station]));
  const landmarks = landmarkDefinitions.flatMap((definition) => {
    const station = parentById.get(definition.id);
    if (!station) return [];
    const point = projectMain([Number(station.stop_lon), Number(station.stop_lat)]);
    return [
      {
        ...definition,
        x: Number(point.x.toFixed(1)),
        y: Number(point.y.toFixed(1)),
      },
    ];
  });

  const schedules = new Map();
  let currentTripId = null;
  let currentStopTimes = [];
  let skippedTrips = 0;

  function consumeTrip() {
    if (!currentTripId || currentStopTimes.length < 2) return;
    const trip = tripById.get(currentTripId);
    const shapeIndex = trip ? shapeIndexById.get(trip.shape_id) : undefined;
    if (!trip || shapeIndex === undefined) {
      skippedTrips += 1;
      return;
    }
    const shape = runtimeShapes[shapeIndex];
    const project = trip.route_id === "SI" ? projectStaten : projectMain;
    const keyframes = [];
    let minimumSegment = 0;
    let minimumDistance = 0;

    for (const stopTime of currentStopTimes) {
      const stop = stopById.get(stopTime.stop_id);
      if (!stop?.stop_lat || !stop?.stop_lon) continue;
      const point = project([Number(stop.stop_lon), Number(stop.stop_lat)]);
      const projection = projectPointToLine(
        point,
        shape.points,
        shape.distances,
        minimumSegment,
      );
      if (!projection) continue;
      minimumSegment = projection.segment;
      minimumDistance = Math.max(minimumDistance, projection.distance);
      keyframes.push([
        parseGtfsTime(stopTime.arrival_time),
        parseGtfsTime(stopTime.departure_time),
        Number(minimumDistance.toFixed(2)),
      ]);
    }

    if (keyframes.length < 2) {
      skippedTrips += 1;
      return;
    }
    const trips = schedules.get(trip.service_id) ?? [];
    trips.push({
      id: trip.trip_id,
      routeId: trip.route_id,
      shapeIndex,
      direction: Number(trip.direction_id || 0),
      startSeconds: keyframes[0][0],
      endSeconds: keyframes.at(-1)[1],
      keyframes,
    });
    schedules.set(trip.service_id, trips);
  }

  for await (const stopTime of streamCsv(gtfsFile("stop_times.txt"))) {
    if (currentTripId && stopTime.trip_id !== currentTripId) {
      consumeTrip();
      currentStopTimes = [];
    }
    currentTripId = stopTime.trip_id;
    currentStopTimes.push(stopTime);
  }
  consumeTrip();

  const map = {
    viewBox: [VIEWBOX.width, VIEWBOX.height],
    boroughs,
    statenIsland: {
      path: pathFromLines(
        polygonRings(statenIslandFeature.geometry),
        projectStaten,
        0.5,
        true,
      ),
    },
    parks: pathFromLines(parkRings, projectMain, 0.32, true),
    streets: {
      arterial: pathFromLines(arterialLines, projectMain, 0.35),
      manhattan: pathFromLines(manhattanLocalLines, projectMain, 0.22),
      statenIsland: pathFromLines(statenArterialLines, projectStaten, 0.28),
    },
    shapes,
    landmarks,
  };
  const mapFile = writeHashedJson("map", map);

  const scheduleFiles = {};
  for (const [serviceId, trips] of [...schedules].sort(([a], [b]) => a.localeCompare(b))) {
    trips.sort((a, b) => a.startSeconds - b.startSeconds || a.id.localeCompare(b.id));
    scheduleFiles[serviceId] = writeHashedJson(
      `schedule-${safeSlug(serviceId)}`,
      { serviceId, trips },
    );
  }

  const feed = readCsv(gtfsFile("feed_info.txt"))[0];
  const calendars = readCsv(gtfsFile("calendar.txt")).map((calendar) => ({
    id: calendar.service_id,
    weekdays: weekdaysFor(calendar),
    startDate: calendar.start_date,
    endDate: calendar.end_date,
  }));
  const exceptions = readCsv(gtfsFile("calendar_dates.txt")).map((exception) => ({
    serviceId: exception.service_id,
    date: exception.date,
    added: exception.exception_type === "1",
  }));

  const hashSources = {
    ...Object.fromEntries(
      [
        "feed_info.txt",
        "calendar.txt",
        "calendar_dates.txt",
        "routes.txt",
        "trips.txt",
        "stop_times.txt",
        "stops.txt",
        "shapes.txt",
      ].map((name) => [`gtfs/${name}`, hashFile(gtfsFile(name))]),
    ),
    [basename(source.boroughs)]: hashFile(source.boroughs),
    [basename(source.majorStreets)]: hashFile(source.majorStreets),
    [basename(source.manhattanStreets)]: hashFile(source.manhattanStreets),
    [basename(source.parks)]: hashFile(source.parks),
  };

  const manifest = {
    schemaVersion: 1,
    feed: {
      publisherName: feed.feed_publisher_name,
      publisherUrl: feed.feed_publisher_url,
      startDate: feed.feed_start_date,
      endDate: feed.feed_end_date,
      version: feed.feed_version,
    },
    mapFile,
    routes,
    routeFamilies: groupRouteFamilies(routes),
    calendars,
    exceptions,
    schedules: scheduleFiles,
    sourceHashes: hashSources,
  };
  writeFileSync(resolve(outputDirectory, "manifest.json"), `${JSON.stringify(manifest)}\n`);

  const totalTrips = [...schedules.values()].reduce((sum, trips) => sum + trips.length, 0);
  console.log(
    `Generated ${shapes.length} shapes and ${totalTrips} scheduled trips from ${feed.feed_version}.`,
  );
  if (skippedTrips) console.warn(`Skipped ${skippedTrips} incomplete trips.`);
  console.log(`Wrote ${outputDirectory} (${statSync(resolve(outputDirectory, "manifest.json")).size} byte manifest).`);
}

await build();

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BOROUGHS_FILE = process.env.NYC_BOROUGHS_FILE ?? "/tmp/nyc-boroughs.geojson";
const MAJOR_STREETS_FILE =
  process.env.NYC_MAJOR_STREETS_FILE ?? "/tmp/nyc-major-streets.geojson";
const MANHATTAN_STREETS_FILE =
  process.env.NYC_MANHATTAN_STREETS_FILE ??
  "/tmp/nyc-manhattan-streets.geojson";
const PARKS_FILE =
  process.env.NYC_PARKS_FILE ?? "/tmp/nyc-parks-named.geojson";
const GTFS_DIRECTORY = process.env.MTA_GTFS_DIRECTORY ?? "/tmp/subway-gtfs";
const OUTPUT_FILE = resolve(
  "app/prototypes/subway-network/_components/city-map-data.ts",
);

const VIEWBOX = { width: 1200, height: 820, padding: 34 };
const ROTATION = (-29 * Math.PI) / 180;
const REFERENCE_LATITUDE = (40.7 * Math.PI) / 180;
const INSET = { x: 28, y: 626, width: 236, height: 154, padding: 13 };

const familyDefinitions = [
  {
    id: "red",
    name: "Broadway–7 Avenue",
    services: ["1", "2", "3"],
    color: "#D82233",
    textColor: "#FFFFFF",
  },
  {
    id: "green",
    name: "Lexington Avenue",
    services: ["4", "5", "6"],
    color: "#009952",
    textColor: "#FFFFFF",
  },
  {
    id: "blue",
    name: "8 Avenue",
    services: ["A", "C", "E"],
    color: "#0062CF",
    textColor: "#FFFFFF",
  },
  {
    id: "orange",
    name: "6 Avenue",
    services: ["B", "D", "F", "M"],
    color: "#EB6800",
    textColor: "#FFFFFF",
  },
  {
    id: "yellow",
    name: "Broadway",
    services: ["N", "Q", "R", "W"],
    color: "#F6BC26",
    textColor: "#171717",
  },
  {
    id: "purple",
    name: "Flushing",
    services: ["7"],
    color: "#9A38A1",
    textColor: "#FFFFFF",
  },
  {
    id: "lime",
    name: "Crosstown",
    services: ["G"],
    color: "#799534",
    textColor: "#FFFFFF",
  },
  {
    id: "gray",
    name: "Canarsie",
    services: ["L"],
    color: "#7C858C",
    textColor: "#FFFFFF",
  },
  {
    id: "brown",
    name: "Nassau Street",
    services: ["J", "Z"],
    color: "#8E5C33",
    textColor: "#FFFFFF",
  },
];

const landmarkParkNames = new Set([
  "Astoria Park",
  "Battery Park City",
  "Brooklyn Bridge Park",
  "Central Park",
  "Flushing Meadows Corona Park",
  "Forest Park",
  "Fort Greene Park",
  "Pelham Bay Park",
  "Prospect Park",
  "Riverside Park",
  "Van Cortlandt Park",
]);

const placeDefinitions = [
  ["Harlem", -73.945, 40.812],
  ["Upper West Side", -73.973, 40.787],
  ["Midtown", -73.985, 40.754],
  ["Lower Manhattan", -74.009, 40.711],
  ["Williamsburg", -73.957, 40.714],
  ["Downtown Brooklyn", -73.987, 40.692],
  ["Long Island City", -73.943, 40.748],
  ["Astoria", -73.921, 40.771],
  ["Jackson Heights", -73.883, 40.755],
  ["Flushing", -73.83, 40.76],
  ["Jamaica", -73.795, 40.703],
  ["Fordham", -73.898, 40.862],
  ["Coney Island", -73.979, 40.577],
];

const hubDefinitions = [
  { id: "127", label: "Times Sq–42 St", dx: -11, dy: -7, anchor: "end" },
  {
    id: "631",
    label: "Grand Central–42 St",
    dx: 12,
    dy: -4,
    anchor: "start",
  },
  { id: "D17", label: "34 St–Herald Sq", dx: -11, dy: 7, anchor: "end" },
  { id: "635", label: "14 St–Union Sq", dx: 12, dy: 10, anchor: "start" },
  { id: "A38", label: "Fulton St", dx: -11, dy: 11, anchor: "end" },
  {
    id: "D24",
    label: "Atlantic Av–Barclays",
    dx: 12,
    dy: 11,
    anchor: "start",
  },
  { id: "G22", label: "Court Sq", dx: 12, dy: -8, anchor: "start" },
  {
    id: "G14",
    label: "Jackson Hts–Roosevelt Av",
    dx: 12,
    dy: -7,
    anchor: "start",
  },
  { id: "G05", label: "Jamaica Center", dx: 12, dy: -7, anchor: "start" },
  { id: "D43", label: "Coney Island–Stillwell Av", dx: 12, dy: 11, anchor: "start" },
  { id: "A24", label: "Columbus Circle", dx: -12, dy: -7, anchor: "end" },
  { id: "A15", label: "125 St", dx: -12, dy: -7, anchor: "end" },
  { id: "414", label: "Yankee Stadium", dx: 12, dy: -7, anchor: "start" },
  { id: "A41", label: "Jay St–MetroTech", dx: -12, dy: 11, anchor: "end" },
  { id: "A51", label: "Broadway Junction", dx: 12, dy: -7, anchor: "start" },
  { id: "701", label: "Flushing–Main St", dx: 12, dy: -7, anchor: "start" },
];

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }

  const [headers, ...values] = rows;
  return values
    .filter((value) => value.length === headers.length)
    .map((value) => Object.fromEntries(headers.map((header, i) => [header, value[i]])));
}

function rawPoint([longitude, latitude]) {
  const x = longitude * Math.cos(REFERENCE_LATITUDE) * 111_320;
  const y = -latitude * 110_540;
  return {
    x: x * Math.cos(ROTATION) - y * Math.sin(ROTATION),
    y: x * Math.sin(ROTATION) + y * Math.cos(ROTATION),
  };
}

function allCoordinates(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "LineString") return geometry.coordinates;
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    return geometry.coordinates.flat();
  }
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function distanceToSegmentSquared(point, start, end) {
  let x = start.x;
  let y = start.y;
  let dx = end.x - x;
  let dy = end.y - y;

  if (dx !== 0 || dy !== 0) {
    const ratio =
      ((point.x - x) * dx + (point.y - y) * dy) / (dx * dx + dy * dy);
    if (ratio > 1) {
      x = end.x;
      y = end.y;
    } else if (ratio > 0) {
      x += dx * ratio;
      y += dy * ratio;
    }
  }

  dx = point.x - x;
  dy = point.y - y;
  return dx * dx + dy * dy;
}

function simplify(points, tolerance) {
  if (points.length <= 2) return points;
  const squaredTolerance = tolerance * tolerance;
  let furthestDistance = squaredTolerance;
  let furthestIndex = 0;

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegmentSquared(
      points[index],
      points[0],
      points[points.length - 1],
    );
    if (distance > furthestDistance) {
      furthestDistance = distance;
      furthestIndex = index;
    }
  }

  if (!furthestIndex) return [points[0], points[points.length - 1]];
  const left = simplify(points.slice(0, furthestIndex + 1), tolerance);
  const right = simplify(points.slice(furthestIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

function pathFromLines(lines, project, tolerance = 0.4, close = false) {
  return lines
    .map((line) => simplify(line.map(project), tolerance))
    .filter((line) => line.length > 1)
    .map(
      (line) =>
        `M${line.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join("L")}${close ? "Z" : ""}`,
    )
    .join("");
}

function polygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

function lineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    area += current.x * next.y - next.x * current.y;
  }
  return Math.abs(area / 2);
}

function centroid(points) {
  const total = points.reduce(
    (result, point) => ({ x: result.x + point.x, y: result.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

function isStatenIslandLine(line) {
  const middle = line[Math.floor(line.length / 2)];
  return middle && middle[0] < -74.05 && middle[1] < 40.66;
}

const boroughGeoJson = readJson(BOROUGHS_FILE);
const majorStreetGeoJson = readJson(MAJOR_STREETS_FILE);
const manhattanStreetGeoJson = readJson(MANHATTAN_STREETS_FILE);
const parkGeoJson = readJson(PARKS_FILE);

const mainBoroughFeatures = boroughGeoJson.features.filter(
  (feature) => feature.properties.boroname !== "Staten Island",
);
const statenIslandFeature = boroughGeoJson.features.find(
  (feature) => feature.properties.boroname === "Staten Island",
);
const rawMainPoints = mainBoroughFeatures.flatMap((feature) =>
  allCoordinates(feature.geometry).map(rawPoint),
);
const bounds = rawMainPoints.reduce(
  (result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, point.y),
  }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);
const scale = Math.min(
  (VIEWBOX.width - VIEWBOX.padding * 2) / (bounds.maxX - bounds.minX),
  (VIEWBOX.height - VIEWBOX.padding * 2) / (bounds.maxY - bounds.minY),
);
const contentWidth = (bounds.maxX - bounds.minX) * scale;
const contentHeight = (bounds.maxY - bounds.minY) * scale;
const offsetX = (VIEWBOX.width - contentWidth) / 2;
const offsetY = (VIEWBOX.height - contentHeight) / 2;

function projectMain(coordinate) {
  const point = rawPoint(coordinate);
  return {
    x: offsetX + (point.x - bounds.minX) * scale,
    y: offsetY + (point.y - bounds.minY) * scale,
  };
}

const statenRawPoints = allCoordinates(statenIslandFeature.geometry).map(rawPoint);
const statenBounds = statenRawPoints.reduce(
  (result, point) => ({
    minX: Math.min(result.minX, point.x),
    minY: Math.min(result.minY, point.y),
    maxX: Math.max(result.maxX, point.x),
    maxY: Math.max(result.maxY, point.y),
  }),
  { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
);
const statenScale = Math.min(
  (INSET.width - INSET.padding * 2) / (statenBounds.maxX - statenBounds.minX),
  (INSET.height - INSET.padding * 2) / (statenBounds.maxY - statenBounds.minY),
);
const statenContentWidth = (statenBounds.maxX - statenBounds.minX) * statenScale;
const statenContentHeight = (statenBounds.maxY - statenBounds.minY) * statenScale;

function projectStaten(coordinate) {
  const point = rawPoint(coordinate);
  return {
    x:
      INSET.x +
      (INSET.width - statenContentWidth) / 2 +
      (point.x - statenBounds.minX) * statenScale,
    y:
      INSET.y +
      (INSET.height - statenContentHeight) / 2 +
      (point.y - statenBounds.minY) * statenScale,
  };
}

const boroughs = mainBoroughFeatures.map((feature) => {
  const rings = polygonRings(feature.geometry);
  const largestRing = rings
    .map((ring) => ring.map(projectMain))
    .sort((a, b) => polygonArea(b) - polygonArea(a))[0];
  const label = centroid(largestRing);
  return {
    id: feature.properties.boroname.toLowerCase().replaceAll(" ", "-"),
    name: feature.properties.boroname,
    path: pathFromLines(rings, projectMain, 0.65, true),
    label: { x: Number(label.x.toFixed(1)), y: Number(label.y.toFixed(1)) },
  };
});

const statenIsland = {
  path: pathFromLines(
    polygonRings(statenIslandFeature.geometry),
    projectStaten,
    0.5,
    true,
  ),
};

const arterialLines = [];
const secondaryLines = [];
const statenArterialLines = [];
for (const feature of majorStreetGeoJson.features) {
  for (const line of lineStrings(feature.geometry)) {
    if (isStatenIslandLine(line)) {
      if (feature.properties.carto_display_level === "10") {
        statenArterialLines.push(line);
      }
    } else if (feature.properties.carto_display_level === "10") {
      arterialLines.push(line);
    } else {
      secondaryLines.push(line);
    }
  }
}

const manhattanLocalLines = manhattanStreetGeoJson.features
  .filter((feature) => !feature.properties.carto_display_level)
  .flatMap((feature) => lineStrings(feature.geometry));

const streets = {
  arterial: pathFromLines(arterialLines, projectMain, 0.35),
  secondary: pathFromLines(secondaryLines, projectMain, 0.3),
  manhattan: pathFromLines(manhattanLocalLines, projectMain, 0.22),
  statenIsland: pathFromLines(statenArterialLines, projectStaten, 0.28),
};

const parkRings = [];
const parkLabels = [];
for (const feature of parkGeoJson.features) {
  const visibleRings = polygonRings(feature.geometry)
    .map((source) => ({ source, projected: source.map(projectMain) }))
    .filter(({ projected }) => polygonArea(projected) > 2.2);
  if (!visibleRings.length) continue;
  parkRings.push(...visibleRings.map(({ source }) => source));

  if (landmarkParkNames.has(feature.properties.propertyname)) {
    const largestRing = visibleRings
      .map(({ projected }) => projected)
      .sort((a, b) => polygonArea(b) - polygonArea(a))[0];
    const label = centroid(largestRing);
    parkLabels.push({
      name: feature.properties.propertyname,
      x: Number(label.x.toFixed(1)),
      y: Number(label.y.toFixed(1)),
    });
  }
}

const parks = pathFromLines(parkRings, projectMain, 0.32, true);

const routes = parseCsv(readFileSync(resolve(GTFS_DIRECTORY, "routes.txt"), "utf8"));
const trips = parseCsv(readFileSync(resolve(GTFS_DIRECTORY, "trips.txt"), "utf8"));
const shapePoints = parseCsv(
  readFileSync(resolve(GTFS_DIRECTORY, "shapes.txt"), "utf8"),
);
const stops = parseCsv(readFileSync(resolve(GTFS_DIRECTORY, "stops.txt"), "utf8"));

const shapeFrequencyByRoute = new Map();
for (const trip of trips) {
  const frequencies = shapeFrequencyByRoute.get(trip.route_id) ?? new Map();
  frequencies.set(trip.shape_id, (frequencies.get(trip.shape_id) ?? 0) + 1);
  shapeFrequencyByRoute.set(trip.route_id, frequencies);
}

const dominantShapeByRoute = new Map(
  [...shapeFrequencyByRoute].map(([routeId, frequencies]) => [
    routeId,
    [...frequencies].sort((a, b) => b[1] - a[1])[0][0],
  ]),
);
const dominantShapeIds = new Set(dominantShapeByRoute.values());
const shapes = new Map();
for (const point of shapePoints) {
  if (!dominantShapeIds.has(point.shape_id)) continue;
  const points = shapes.get(point.shape_id) ?? [];
  points.push([Number(point.shape_pt_lon), Number(point.shape_pt_lat)]);
  shapes.set(point.shape_id, points);
}

const routeMetadata = new Map(routes.map((route) => [route.route_id, route]));
const routeFamilies = familyDefinitions.map((family, familyIndex) => {
  const services = family.services.map((service, serviceIndex) => {
    const shapeId = dominantShapeByRoute.get(service);
    const coordinates = shapes.get(shapeId);
    const metadata = routeMetadata.get(service);
    return {
      id: service,
      label: metadata?.route_short_name ?? service,
      path: pathFromLines([coordinates], projectMain, 0.55),
      duration: 27 + ((familyIndex * 7 + serviceIndex * 5) % 15),
    };
  });
  return {
    ...family,
    networkPath: services.map((service) => service.path).join(""),
    services,
  };
});

const sirShapeId = dominantShapeByRoute.get("SI");
const sirCoordinates = shapes.get(sirShapeId);
const sir = {
  id: "SIR",
  color: "#08179C",
  textColor: "#FFFFFF",
  path: pathFromLines([sirCoordinates], projectStaten, 0.42),
  duration: 24,
};

const stations = stops
  .filter((stop) => stop.location_type === "1" && stop.stop_lat && stop.stop_lon)
  .filter((stop) => stop.stop_id !== "S31" && !stop.stop_id.startsWith("S"))
  .map((stop) => ({
    id: stop.stop_id,
    name: stop.stop_name,
    ...projectMain([Number(stop.stop_lon), Number(stop.stop_lat)]),
  }))
  .map((station) => ({
    ...station,
    x: Number(station.x.toFixed(1)),
    y: Number(station.y.toFixed(1)),
  }));

const stationById = new Map(stations.map((station) => [station.id, station]));
const hubs = hubDefinitions
  .map((definition) => {
    const station = stationById.get(definition.id);
    if (!station) return null;
    return {
      id: definition.id,
      name: station.name,
      label: definition.label,
      x: station.x,
      y: station.y,
      dx: definition.dx,
      dy: definition.dy,
      anchor: definition.anchor,
    };
  })
  .filter(Boolean);

const places = placeDefinitions.map(([name, longitude, latitude]) => ({
  name,
  ...projectMain([longitude, latitude]),
}));

const data = {
  viewBox: `0 0 ${VIEWBOX.width} ${VIEWBOX.height}`,
  boroughs,
  statenIsland,
  streets,
  parks,
  parkLabels,
  routeFamilies,
  sir,
  stations,
  hubs,
  places,
};

const output = `// Generated by scripts/generate-subway-prototype-data.mjs.\n// Sources: NYC Borough Boundaries, NYC Street Centerline, NYC Functional Parkland, and MTA static subway GTFS.\n// This file is prototype-only cartography and must not be treated as an official MTA map.\n\nexport const cityMapData = ${JSON.stringify(data)} as const;\n`;

writeFileSync(OUTPUT_FILE, output);
console.log(`Wrote ${OUTPUT_FILE} (${Math.round(output.length / 1024)} KiB)`);

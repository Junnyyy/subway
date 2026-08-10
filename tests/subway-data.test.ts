import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolve } from "node:path";
import type {
  ScheduleChunk,
  SubwayManifest,
  SubwayMapData,
} from "../lib/subway/types.ts";

const manifestPath = resolve("public/data/subway/manifest.json");

function readJson<T>(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

test("generated subway manifest references complete production artifacts", () => {
  assert.equal(existsSync(manifestPath), true);
  const manifest = readJson<SubwayManifest>(manifestPath);
  assert.equal(manifest.schemaVersion, 1);
  assert.ok(manifest.feed.startDate < manifest.feed.endDate);
  assert.equal(manifest.routes.length, 29);
  assert.ok(Object.keys(manifest.schedules).length >= 3);
  assert.ok(
    Object.values(manifest.sourceHashes).every((hash) => /^[a-f0-9]{64}$/.test(hash)),
  );

  for (const file of [manifest.mapFile, ...Object.values(manifest.schedules)]) {
    assert.equal(existsSync(resolve("public", file.slice(1))), true, file);
  }
});

test("every route belongs to exactly one matching color family", () => {
  const manifest = readJson<SubwayManifest>(manifestPath);
  const routeById = new Map(manifest.routes.map((route) => [route.id, route]));
  const groupedRouteIds = manifest.routeFamilies.flatMap(
    (family) => family.routeIds,
  );

  assert.equal(new Set(groupedRouteIds).size, groupedRouteIds.length);
  assert.deepEqual(
    [...groupedRouteIds].sort(),
    manifest.routes.map((route) => route.id).sort(),
  );

  for (const family of manifest.routeFamilies) {
    for (const routeId of family.routeIds) {
      const route = routeById.get(routeId);
      assert.ok(route, `missing route ${routeId}`);
      assert.equal(route.color, family.color);
      assert.equal(route.textColor, family.textColor);
      assert.ok(family.labels.includes(route.label));
    }
  }
});

test("generated map preserves the selected sparse landmark composition", () => {
  const manifest = readJson<SubwayManifest>(manifestPath);
  const map = readJson<SubwayMapData>(resolve("public", manifest.mapFile.slice(1)));
  assert.deepEqual(map.viewBox, [1200, 820]);
  assert.ok(map.shapes.length >= 250);
  assert.equal(map.landmarks.length, 19);
  const parkCoordinates = (map.parks.match(/-?\d+(?:\.\d+)?/g) ?? [])
    .map(Number)
    .reduce<Array<[number, number]>>((points, value, index, values) => {
      if (index % 2 === 0) points.push([value, values[index + 1]]);
      return points;
    }, []);
  assert.equal(
    parkCoordinates.some(([x, y]) => x < 280 && y > 600),
    false,
    "main-map parks must not leak into the Staten Island inset",
  );
  assert.deepEqual(
    map.landmarks
      .filter((landmark) => ["117", "A32", "E01"].includes(landmark.id))
      .map((landmark) => landmark.label),
    [
      "116 St–Columbia University",
      "W 4 St–NYU",
      "World Trade Center",
    ],
  );
});

test("generated cartography and route shapes stay inside their intended frames", () => {
  const manifest = readJson<SubwayManifest>(manifestPath);
  const map = readJson<SubwayMapData>(resolve("public", manifest.mapFile.slice(1)));
  const routeIds = new Set(manifest.routes.map((route) => route.id));
  const landmarkIds = new Set<string>();
  let statenIslandShapes = 0;
  let mainMapShapes = 0;

  assert.deepEqual(
    map.boroughs.map((borough) => borough.name).sort(),
    ["Bronx", "Brooklyn", "Manhattan", "Queens"],
  );
  assert.ok(map.boroughs.every((borough) => borough.path.length > 100));
  assert.ok(map.statenIsland.path.length > 100);
  assert.ok(map.parks.length > 100);
  assert.ok(Object.values(map.streets).every((path) => path.length > 100));

  for (const shape of map.shapes) {
    assert.ok(routeIds.has(shape.routeId), `unknown route ${shape.routeId}`);
    assert.ok(shape.points.length >= 4);
    assert.equal(shape.points.length % 2, 0);
    assert.equal(shape.distances.length, shape.points.length / 2);
    assert.ok(shape.distances.at(-1)! > 0);

    for (let index = 1; index < shape.distances.length; index += 1) {
      assert.ok(shape.distances[index - 1] <= shape.distances[index]);
    }

    for (let index = 0; index < shape.points.length; index += 2) {
      const x = shape.points[index];
      const y = shape.points[index + 1];
      assert.ok(x >= 0 && x <= map.viewBox[0], `${shape.id} x=${x}`);
      assert.ok(y >= 0 && y <= map.viewBox[1], `${shape.id} y=${y}`);
      if (shape.routeId === "SI") {
        assert.ok(x < 280 && y > 600, `${shape.id} escaped Staten Island`);
      }
    }

    if (shape.routeId === "SI") statenIslandShapes += 1;
    else mainMapShapes += 1;
  }

  assert.ok(statenIslandShapes > 0);
  assert.ok(mainMapShapes >= 200);

  for (const landmark of map.landmarks) {
    assert.equal(landmarkIds.has(landmark.id), false, landmark.id);
    landmarkIds.add(landmark.id);
    assert.ok(landmark.x >= 0 && landmark.x <= map.viewBox[0]);
    assert.ok(landmark.y >= 0 && landmark.y <= map.viewBox[1]);
  }
});

test("schedule chunks contain monotonic trip keyframes", () => {
  const manifest = readJson<SubwayManifest>(manifestPath);
  const weekdayFile = manifest.schedules.Weekday;
  assert.ok(weekdayFile);
  const schedule = readJson<ScheduleChunk>(resolve("public", weekdayFile.slice(1)));
  assert.ok(schedule.trips.length > 8_000);

  for (const trip of schedule.trips.slice(0, 250)) {
    assert.ok(trip.startSeconds <= trip.endSeconds);
    for (let index = 1; index < trip.keyframes.length; index += 1) {
      assert.ok(trip.keyframes[index - 1][0] <= trip.keyframes[index][0]);
      assert.ok(trip.keyframes[index - 1][2] <= trip.keyframes[index][2]);
    }
  }
});

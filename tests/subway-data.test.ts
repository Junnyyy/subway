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

test("generated map preserves the selected sparse landmark composition", () => {
  const manifest = readJson<SubwayManifest>(manifestPath);
  const map = readJson<SubwayMapData>(resolve("public", manifest.mapFile.slice(1)));
  assert.deepEqual(map.viewBox, [1200, 820]);
  assert.ok(map.shapes.length >= 250);
  assert.equal(map.landmarks.length, 19);
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

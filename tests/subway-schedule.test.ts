import assert from "node:assert/strict";
import test from "node:test";
import {
  activeServiceIds,
  getNewYorkClock,
  parseGtfsTime,
  positionAtDistance,
  sampleScheduledTrip,
  shapePointsBetweenDistances,
  shiftServiceDate,
} from "../lib/subway/schedule.ts";
import type { ScheduledTrip, ShapeDefinition } from "../lib/subway/types.ts";

test("parses GTFS service times beyond midnight", () => {
  assert.equal(parseGtfsTime("00:06:30"), 390);
  assert.equal(parseGtfsTime("25:10:05"), 90_605);
  assert.throws(() => parseGtfsTime("12:70:00"), /Invalid GTFS time/);
});

test("shifts compact service dates without local timezone drift", () => {
  assert.equal(shiftServiceDate("20260810", -1), "20260809");
  assert.equal(shiftServiceDate("20260301", -1), "20260228");
});

test("reads the wall clock in New York across daylight-saving seasons", () => {
  assert.deepEqual(getNewYorkClock(new Date("2026-08-10T06:30:45Z")), {
    serviceDate: "20260810",
    seconds: 9_045,
  });
  assert.deepEqual(getNewYorkClock(new Date("2026-01-10T06:30:45Z")), {
    serviceDate: "20260110",
    seconds: 5_445,
  });
});

test("applies service calendar additions and removals", () => {
  const calendars = [
    {
      id: "Weekday",
      weekdays: [1, 2, 3, 4, 5],
      startDate: "20260101",
      endDate: "20261231",
    },
  ];
  const exceptions = [
    { serviceId: "Weekday", date: "20260703", added: false },
    { serviceId: "Saturday", date: "20260703", added: true },
  ];
  assert.deepEqual(activeServiceIds(calendars, exceptions, "20260702"), [
    "Weekday",
  ]);
  assert.deepEqual(activeServiceIds(calendars, exceptions, "20260703"), [
    "Saturday",
  ]);
});

const shape: ShapeDefinition = {
  id: "shape",
  routeId: "A",
  points: [0, 0, 10, 0, 20, 0],
  distances: [0, 10, 20],
  laneFactors: [0, 0, 0],
};

const trip: ScheduledTrip = {
  id: "trip",
  routeId: "A",
  shapeIndex: 0,
  direction: 0,
  startSeconds: 100,
  endSeconds: 220,
  keyframes: [
    [100, 110, 0],
    [160, 170, 10],
    [220, 220, 20],
  ],
};

test("holds a scheduled train during dwell time", () => {
  assert.deepEqual(sampleScheduledTrip(trip, shape, 105), {
    x: 0,
    y: 0,
    distance: 0,
    progress: 0,
  });
  assert.equal(sampleScheduledTrip(trip, shape, 165)?.distance, 10);
});

test("traces a local direction segment through the actual shape geometry", () => {
  const curvedShape: ShapeDefinition = {
    id: "curve",
    routeId: "A",
    points: [0, 0, 10, 10, 20, 0],
    distances: [0, 10, 20],
    laneFactors: [0, 0, 0],
  };

  assert.deepEqual(shapePointsBetweenDistances(curvedShape, 5, 15), [
    { x: 5, y: 5 },
    { x: 10, y: 10 },
    { x: 15, y: 5 },
  ]);
});

test("keeps train positions and direction paths on lane-aware geometry", () => {
  const laneShape: ShapeDefinition = {
    id: "lane",
    routeId: "A",
    points: [0, 0, 10, 0, 20, 0],
    distances: [0, 10, 20],
    laneFactors: [1, 1, 1],
  };

  assert.deepEqual(positionAtDistance(laneShape, 5, 2), {
    x: 5,
    y: 2,
    distance: 5,
    progress: 0.25,
  });
  assert.deepEqual(shapePointsBetweenDistances(laneShape, 5, 15, 2), [
    { x: 5, y: 2 },
    { x: 10, y: 2 },
    { x: 15, y: 2 },
  ]);
  assert.equal(sampleScheduledTrip(trip, laneShape, 135, 2)?.y, 2);
});

test("keeps a lane on the same visual side when a shape reverses", () => {
  const forward: ShapeDefinition = {
    id: "forward",
    routeId: "A",
    points: [0, 0, 10, 0, 20, 0],
    distances: [0, 10, 20],
    laneFactors: [1, 1, 1],
  };
  const reverse: ShapeDefinition = {
    id: "reverse",
    routeId: "A",
    points: [20, 0, 10, 0, 0, 0],
    distances: [0, 10, 20],
    laneFactors: [1, 1, 1],
  };

  assert.equal(positionAtDistance(forward, 10, 3)?.y, 3);
  assert.equal(positionAtDistance(reverse, 10, 3)?.y, 3);
});

test("interpolates between scheduled stops and clamps shape distances", () => {
  assert.equal(sampleScheduledTrip(trip, shape, 135)?.distance, 5);
  assert.deepEqual(positionAtDistance(shape, 100), {
    x: 20,
    y: 0,
    distance: 20,
    progress: 1,
  });
  assert.equal(sampleScheduledTrip(trip, shape, 99), null);
});

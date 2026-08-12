import assert from "node:assert/strict";
import test from "node:test";
import { canvasPixelRatio } from "../lib/subway/canvas.ts";

test("uses native 3x density for a typical mobile map", () => {
  assert.equal(canvasPixelRatio(390, 473, 3), 3);
});

test("keeps the existing desktop density cap", () => {
  assert.equal(canvasPixelRatio(1200, 900, 3), 2);
});

test("limits unusually large mobile canvases to the pixel budget", () => {
  const ratio = canvasPixelRatio(639, 1_000, 3);
  assert.ok(ratio < 2);
  assert.ok(639 * 1_000 * ratio * ratio <= 2_500_000.0001);
});

test("never downscales a standard-density screen", () => {
  assert.equal(canvasPixelRatio(390, 844, 1), 1);
});

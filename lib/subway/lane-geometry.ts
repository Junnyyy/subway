import type { ShapeDefinition } from "./types";

export type MapPoint = {
  x: number;
  y: number;
};

const orientationCache = new WeakMap<ShapeDefinition, number>();

function shapeOrientation(shape: ShapeDefinition) {
  const cached = orientationCache.get(shape);
  if (cached) return cached;
  const endX = shape.points.at(-2) ?? shape.points[0];
  const endY = shape.points.at(-1) ?? shape.points[1];
  const shapeDx = endX - shape.points[0];
  const shapeDy = endY - shape.points[1];
  const orientation =
    Math.abs(shapeDx) > Math.abs(shapeDy)
      ? shapeDx >= 0
        ? 1
        : -1
      : shapeDy >= 0
        ? 1
        : -1;
  orientationCache.set(shape, orientation);
  return orientation;
}

export function shapePointAtIndex(
  shape: ShapeDefinition,
  index: number,
  laneSpacing = 0,
): MapPoint {
  const pointCount = shape.points.length / 2;
  const pointIndex = Math.min(pointCount - 1, Math.max(0, index));
  const previous = Math.max(0, pointIndex - 1) * 2;
  const next = Math.min(pointCount - 1, pointIndex + 1) * 2;
  const dx = shape.points[next] - shape.points[previous];
  const dy = shape.points[next + 1] - shape.points[previous + 1];
  const length = Math.hypot(dx, dy) || 1;
  const orientation = shapeOrientation(shape);
  const offset = (shape.laneFactors[pointIndex] ?? 0) * laneSpacing;

  return {
    x: shape.points[pointIndex * 2] + (-dy / length) * offset * orientation,
    y:
      shape.points[pointIndex * 2 + 1] +
      (dx / length) * offset * orientation,
  };
}

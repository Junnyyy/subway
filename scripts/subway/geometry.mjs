export function distanceToSegment(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  const ratio = lengthSquared
    ? Math.min(
        1,
        Math.max(
          0,
          ((point.x - start.x) * dx + (point.y - start.y) * dy) /
            lengthSquared,
        ),
      )
    : 0;
  const x = start.x + dx * ratio;
  const y = start.y + dy * ratio;
  const offsetX = point.x - x;
  const offsetY = point.y - y;
  return { x, y, ratio, squaredDistance: offsetX * offsetX + offsetY * offsetY };
}

export function cumulativeDistances(points) {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    const dx = points[index].x - points[index - 1].x;
    const dy = points[index].y - points[index - 1].y;
    distances.push(distances[index - 1] + Math.hypot(dx, dy));
  }
  return distances;
}

export function projectPointToLine(point, points, distances, minimumSegment = 0) {
  let best = null;
  for (
    let index = Math.max(0, minimumSegment);
    index < points.length - 1;
    index += 1
  ) {
    const projection = distanceToSegment(point, points[index], points[index + 1]);
    if (!best || projection.squaredDistance < best.squaredDistance) {
      const segmentLength = distances[index + 1] - distances[index];
      best = {
        ...projection,
        segment: index,
        distance: distances[index] + segmentLength * projection.ratio,
      };
    }
  }
  return best;
}

function distanceToSegmentSquared(point, start, end) {
  return distanceToSegment(point, start, end).squaredDistance;
}

export function simplify(points, tolerance) {
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

  if (!furthestIndex) return [points[0], points.at(-1)];
  const left = simplify(points.slice(0, furthestIndex + 1), tolerance);
  const right = simplify(points.slice(furthestIndex), tolerance);
  return [...left.slice(0, -1), ...right];
}

export function pathFromLines(lines, project, tolerance = 0.4, close = false) {
  return lines
    .map((line) => simplify(line.map(project), tolerance))
    .filter((line) => line.length > 1)
    .map(
      (line) =>
        `M${line.map((point) => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join("L")}${close ? "Z" : ""}`,
    )
    .join("");
}

export function polygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

export function lineStrings(geometry) {
  if (!geometry) return [];
  if (geometry.type === "LineString") return [geometry.coordinates];
  if (geometry.type === "MultiLineString") return geometry.coordinates;
  return [];
}

export function allCoordinates(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "LineString") return geometry.coordinates;
  if (geometry.type === "MultiLineString" || geometry.type === "Polygon") {
    return geometry.coordinates.flat();
  }
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

export function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area / 2);
}

export function centroid(points) {
  const total = points.reduce(
    (result, point) => ({ x: result.x + point.x, y: result.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / points.length, y: total.y / points.length };
}

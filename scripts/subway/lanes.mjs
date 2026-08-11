const GRID_SIZE = 4.5;
const ANGLE_BUCKETS = 12;
const SHARED_ANGLE_LIMIT = Math.PI / 7;

function normalizedAngle(dx, dy) {
  const angle = Math.atan2(dy, dx);
  return angle < 0 ? angle + Math.PI : angle >= Math.PI ? angle - Math.PI : angle;
}

function angleDistance(first, second) {
  const difference = Math.abs(first - second);
  return Math.min(difference, Math.PI - difference);
}

export function buildLaneFactors(shapes, routeFamilies) {
  const familyByRoute = new Map();
  routeFamilies.forEach((family, familyIndex) => {
    family.routeIds.forEach((routeId) => familyByRoute.set(routeId, familyIndex));
  });

  const grid = new Map();
  const addSample = (sample) => {
    const cellX = Math.floor(sample.x / GRID_SIZE);
    const cellY = Math.floor(sample.y / GRID_SIZE);
    const bucket =
      Math.round((sample.angle / Math.PI) * ANGLE_BUCKETS) % ANGLE_BUCKETS;
    const cellKey = `${cellX}:${cellY}`;
    const cell = grid.get(cellKey) ?? new Map();
    const sampleKey = `${sample.family}:${bucket}`;
    if (!cell.has(sampleKey)) cell.set(sampleKey, sample);
    grid.set(cellKey, cell);
  };

  for (const shape of shapes) {
    const family = familyByRoute.get(shape.routeId);
    if (family === undefined) continue;
    for (let index = 0; index < shape.points.length - 2; index += 2) {
      const startX = shape.points[index];
      const startY = shape.points[index + 1];
      const dx = shape.points[index + 2] - startX;
      const dy = shape.points[index + 3] - startY;
      const length = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(length / (GRID_SIZE * 0.55)));
      const angle = normalizedAngle(dx, dy);
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        addSample({
          x: startX + dx * progress,
          y: startY + dy * progress,
          angle,
          family,
        });
      }
    }
  }

  return shapes.map((shape) => {
    const family = familyByRoute.get(shape.routeId);
    const pointCount = shape.points.length / 2;
    if (family === undefined) return Array(pointCount).fill(0);

    let factors = Array.from({ length: pointCount }, (_, index) => {
      const previous = Math.max(0, index - 1) * 2;
      const next = Math.min(pointCount - 1, index + 1) * 2;
      const x = shape.points[index * 2];
      const y = shape.points[index * 2 + 1];
      const angle = normalizedAngle(
        shape.points[next] - shape.points[previous],
        shape.points[next + 1] - shape.points[previous + 1],
      );
      const cellX = Math.floor(x / GRID_SIZE);
      const cellY = Math.floor(y / GRID_SIZE);
      const nearbyFamilies = new Set([family]);

      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const cell = grid.get(`${cellX + offsetX}:${cellY + offsetY}`);
          if (!cell) continue;
          for (const sample of cell.values()) {
            if (
              Math.hypot(sample.x - x, sample.y - y) <= GRID_SIZE * 1.35 &&
              angleDistance(sample.angle, angle) <= SHARED_ANGLE_LIMIT
            ) {
              nearbyFamilies.add(sample.family);
            }
          }
        }
      }

      const orderedFamilies = [...nearbyFamilies].sort((a, b) => a - b);
      if (orderedFamilies.length < 2) return 0;
      return (
        orderedFamilies.indexOf(family) - (orderedFamilies.length - 1) / 2
      );
    });

    for (let pass = 0; pass < 3; pass += 1) {
      factors = factors.map((factor, index, values) => {
        const previous = values[Math.max(0, index - 1)];
        const next = values[Math.min(values.length - 1, index + 1)];
        return previous * 0.25 + factor * 0.5 + next * 0.25;
      });
    }

    return factors.map((factor) => Number(factor.toFixed(4)));
  });
}

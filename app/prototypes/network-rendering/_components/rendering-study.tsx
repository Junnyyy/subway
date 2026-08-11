"use client";

import {
  type CSSProperties,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  RouteFamily,
  SubwayManifest,
  SubwayMapData,
} from "@/lib/subway/types";
import styles from "./network-rendering.module.css";

export type ViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

type DetailedShape = {
  id: string;
  routeId: string;
  points: number[];
  length: number;
};

type DetailedGeometry = {
  schemaVersion: 1;
  feedVersion: string;
  tolerance: number;
  viewBox: readonly [number, number];
  shapes: DetailedShape[];
};

export type PrototypeScene = {
  manifest: SubwayManifest;
  map: SubwayMapData;
  detail: DetailedGeometry;
};

export type StudyVariantProps = {
  scene: PrototypeScene | null;
  loadError: string | null;
  dark: boolean;
  view: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
  resetView: () => void;
  toggleTheme: () => void;
};

type RenderingStudyProps = StudyVariantProps & {
  mode: "reference" | "bands" | "lanes";
  eyebrow: string;
  title: string;
  description: string;
  geometryLabel: string;
  overlapLabel: string;
};

type Point = { x: number; y: number };

type LaneShape = {
  shape: DetailedShape;
  factors: number[];
};

const palette = {
  light: {
    water: "#f4f7f8",
    land: "#fdfcf9",
    park: "#e4eee4",
    parkStroke: "rgba(65, 104, 72, 0.18)",
    ink: "#25303a",
    muted: "#68737d",
    faint: "#98a0a7",
    hairline: "rgba(37, 48, 58, 0.11)",
    street: "rgba(88, 99, 108, 0.55)",
    localStreet: "rgba(115, 124, 132, 0.36)",
    casing: "rgba(253, 252, 249, 0.94)",
  },
  dark: {
    water: "#060709",
    land: "#111417",
    park: "#14251a",
    parkStroke: "rgba(110, 166, 122, 0.2)",
    ink: "#f1f3f4",
    muted: "#9ca4aa",
    faint: "#545d64",
    hairline: "rgba(241, 243, 244, 0.1)",
    street: "rgba(178, 186, 192, 0.28)",
    localStreet: "rgba(158, 168, 176, 0.16)",
    casing: "rgba(5, 6, 8, 0.94)",
  },
} as const;

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const GRID_SIZE = 4.5;
const ANGLE_BUCKETS = 12;
const SHARED_ANGLE_LIMIT = Math.PI / 7;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const pixelWidth = Math.max(1, Math.round(width * ratio));
  const pixelHeight = Math.max(1, Math.round(height * ratio));
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context?.setTransform(ratio, 0, 0, ratio, 0, 0);
  return context;
}

function mapTransform(width: number, height: number, camera: ViewState) {
  const mobile = width < 640;
  const frame = mobile
    ? { x: 235, y: 88, width: 555, height: 720 }
    : { x: 280, y: 20, width: 640, height: 780 };
  const baseScale = Math.min(width / frame.width, height / frame.height);
  const baseX = (width - frame.width * baseScale) / 2 - frame.x * baseScale;
  const baseY = (height - frame.height * baseScale) / 2 - frame.y * baseScale;
  return {
    scale: baseScale * camera.zoom,
    x: width / 2 + camera.panX + camera.zoom * (baseX - width / 2),
    y: height / 2 + camera.panY + camera.zoom * (baseY - height / 2),
  };
}

function applyMapTransform(
  context: CanvasRenderingContext2D,
  transform: ReturnType<typeof mapTransform>,
) {
  context.translate(transform.x, transform.y);
  context.scale(transform.scale, transform.scale);
}

function traceShape(
  context: CanvasRenderingContext2D,
  points: readonly number[],
) {
  if (points.length < 4) return;
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
}

function shapeOrientation(points: readonly number[]) {
  const dx = points.at(-2)! - points[0];
  const dy = points.at(-1)! - points[1];
  return Math.abs(dx) > Math.abs(dy) ? (dx >= 0 ? 1 : -1) : dy >= 0 ? 1 : -1;
}

function traceLaneShape(
  context: CanvasRenderingContext2D,
  laneShape: LaneShape,
  spacing: number,
) {
  const { points } = laneShape.shape;
  const count = points.length / 2;
  if (count < 2) return;
  const orientation = shapeOrientation(points);

  context.beginPath();
  for (let index = 0; index < count; index += 1) {
    const previous = Math.max(0, index - 1) * 2;
    const next = Math.min(count - 1, index + 1) * 2;
    const dx = points[next] - points[previous];
    const dy = points[next + 1] - points[previous + 1];
    const length = Math.hypot(dx, dy) || 1;
    const offset = laneShape.factors[index] * spacing;
    const x = points[index * 2] + (-dy / length) * offset * orientation;
    const y = points[index * 2 + 1] + (dx / length) * offset * orientation;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
}

function normalizedAngle(dx: number, dy: number) {
  const angle = Math.atan2(dy, dx);
  return angle < 0 ? angle + Math.PI : angle >= Math.PI ? angle - Math.PI : angle;
}

function angleDistance(first: number, second: number) {
  const difference = Math.abs(first - second);
  return Math.min(difference, Math.PI - difference);
}

function buildLaneShapes(
  shapes: DetailedShape[],
  families: RouteFamily[],
): LaneShape[] {
  const familyByRoute = new Map<number | string, number>();
  families.forEach((family, familyIndex) => {
    family.routeIds.forEach((routeId) => familyByRoute.set(routeId, familyIndex));
  });

  type Sample = { x: number; y: number; angle: number; family: number };
  const grid = new Map<string, Map<string, Sample>>();

  const addSample = (sample: Sample) => {
    const cellX = Math.floor(sample.x / GRID_SIZE);
    const cellY = Math.floor(sample.y / GRID_SIZE);
    const bucket = Math.round((sample.angle / Math.PI) * ANGLE_BUCKETS) % ANGLE_BUCKETS;
    const key = `${cellX}:${cellY}`;
    const cell = grid.get(key) ?? new Map<string, Sample>();
    const sampleKey = `${sample.family}:${bucket}`;
    if (!cell.has(sampleKey)) cell.set(sampleKey, sample);
    grid.set(key, cell);
  };

  for (const shape of shapes) {
    const family = familyByRoute.get(shape.routeId);
    if (family === undefined) continue;
    for (let index = 0; index < shape.points.length - 2; index += 2) {
      const startX = shape.points[index];
      const startY = shape.points[index + 1];
      const endX = shape.points[index + 2];
      const endY = shape.points[index + 3];
      const dx = endX - startX;
      const dy = endY - startY;
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
    if (family === undefined) return { shape, factors: Array(pointCount).fill(0) };

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
      const nearbyFamilies = new Set<number>([family]);

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

      const ordered = [...nearbyFamilies].sort((a, b) => a - b);
      if (ordered.length < 2) return 0;
      return ordered.indexOf(family) - (ordered.length - 1) / 2;
    });

    for (let pass = 0; pass < 3; pass += 1) {
      factors = factors.map((factor, index, values) => {
        const previous = values[Math.max(0, index - 1)];
        const next = values[Math.min(values.length - 1, index + 1)];
        return previous * 0.25 + factor * 0.5 + next * 0.25;
      });
    }

    return { shape, factors };
  });
}

function drawBaseMap(
  context: CanvasRenderingContext2D,
  map: SubwayMapData,
  colors: (typeof palette)[keyof typeof palette],
  transform: ReturnType<typeof mapTransform>,
  fontFamily: string,
) {
  const strokeWidth = (value: number) => value / transform.scale;

  context.fillStyle = colors.land;
  context.strokeStyle = colors.hairline;
  context.lineWidth = strokeWidth(1);
  for (const borough of map.boroughs) {
    const path = new Path2D(borough.path);
    context.fill(path, "evenodd");
    context.stroke(path);
  }

  const parks = new Path2D(map.parks);
  context.fillStyle = colors.park;
  context.strokeStyle = colors.parkStroke;
  context.lineWidth = strokeWidth(0.7);
  context.fill(parks, "evenodd");
  context.stroke(parks);

  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = colors.localStreet;
  context.lineWidth = strokeWidth(0.55);
  context.stroke(new Path2D(map.streets.manhattan));
  context.strokeStyle = colors.street;
  context.lineWidth = strokeWidth(1);
  context.stroke(new Path2D(map.streets.arterial));

  context.textBaseline = "middle";
  context.fillStyle = colors.faint;
  context.textAlign = "center";
  context.font = `650 ${11 / transform.scale}px ${fontFamily}`;
  for (const borough of map.boroughs) {
    context.fillText(borough.name.toUpperCase(), borough.label.x, borough.label.y);
  }
}

function drawLabels(
  context: CanvasRenderingContext2D,
  map: SubwayMapData,
  colors: (typeof palette)[keyof typeof palette],
  transform: ReturnType<typeof mapTransform>,
  fontFamily: string,
) {
  const strokeWidth = (value: number) => value / transform.scale;
  context.lineWidth = strokeWidth(0.7);
  context.strokeStyle = colors.muted;
  context.fillStyle = colors.land;
  for (const landmark of map.landmarks) {
    context.beginPath();
    context.arc(landmark.x, landmark.y, 3.4 / transform.scale, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }

  context.fillStyle = colors.muted;
  context.font = `610 ${9 / transform.scale}px ${fontFamily}`;
  for (const landmark of map.landmarks) {
    const x = landmark.x + landmark.dx / transform.scale;
    const y = landmark.y + landmark.dy / transform.scale;
    context.textAlign = landmark.anchor === "middle" ? "center" : landmark.anchor;
    context.strokeStyle = colors.land;
    context.lineWidth = strokeWidth(3.5);
    context.strokeText(landmark.label, x, y);
    context.fillText(landmark.label, x, y);
  }
}

function drawReferenceLines(
  context: CanvasRenderingContext2D,
  scene: PrototypeScene,
  colors: (typeof palette)[keyof typeof palette],
  transform: ReturnType<typeof mapTransform>,
) {
  const routeById = new Map(scene.manifest.routes.map((route) => [route.id, route]));
  context.strokeStyle = colors.casing;
  context.lineWidth = 6.2 / transform.scale;
  for (const shape of scene.map.shapes) {
    if (shape.routeId === "SI" || !routeById.has(shape.routeId)) continue;
    traceShape(context, shape.points);
    context.stroke();
  }

  context.lineWidth = 3.4 / transform.scale;
  for (const shape of scene.map.shapes) {
    if (shape.routeId === "SI") continue;
    const route = routeById.get(shape.routeId);
    if (!route) continue;
    context.strokeStyle = route.color;
    traceShape(context, shape.points);
    context.stroke();
  }
}

function detailedFamilyGroups(scene: PrototypeScene, families: RouteFamily[]) {
  return families
    .map((family) => {
      const routeIds = new Set(family.routeIds);
      const shapes = scene.detail.shapes.filter((shape) => routeIds.has(shape.routeId));
      const longestShape = Math.max(...shapes.map((shape) => shape.length), 0);
      return { family, shapes, longestShape };
    })
    .sort((first, second) => first.longestShape - second.longestShape);
}

function drawBandLines(
  context: CanvasRenderingContext2D,
  scene: PrototypeScene,
  families: RouteFamily[],
  colors: (typeof palette)[keyof typeof palette],
  transform: ReturnType<typeof mapTransform>,
) {
  for (const group of detailedFamilyGroups(scene, families)) {
    context.strokeStyle = colors.casing;
    context.lineWidth = 6.2 / transform.scale;
    for (const shape of group.shapes) {
      traceShape(context, shape.points);
      context.stroke();
    }
    context.strokeStyle = group.family.color;
    context.lineWidth = 3.4 / transform.scale;
    for (const shape of group.shapes) {
      traceShape(context, shape.points);
      context.stroke();
    }
  }
}

function drawLaneLines(
  context: CanvasRenderingContext2D,
  laneShapes: LaneShape[],
  families: RouteFamily[],
  colors: (typeof palette)[keyof typeof palette],
  transform: ReturnType<typeof mapTransform>,
) {
  const shapesByRoute = new Map<string, LaneShape[]>();
  for (const laneShape of laneShapes) {
    const routeShapes = shapesByRoute.get(laneShape.shape.routeId) ?? [];
    routeShapes.push(laneShape);
    shapesByRoute.set(laneShape.shape.routeId, routeShapes);
  }
  const spacing = 4.7 / transform.scale;

  for (const family of families) {
    const familyShapes = family.routeIds.flatMap(
      (routeId) => shapesByRoute.get(routeId) ?? [],
    );
    context.strokeStyle = colors.casing;
    context.lineWidth = 4.4 / transform.scale;
    for (const shape of familyShapes) {
      traceLaneShape(context, shape, spacing);
      context.stroke();
    }
    context.strokeStyle = family.color;
    context.lineWidth = 2.6 / transform.scale;
    for (const shape of familyShapes) {
      traceLaneShape(context, shape, spacing);
      context.stroke();
    }
  }
}

function NetworkCanvas({
  scene,
  mode,
  dark,
  view,
  setView,
  resetView,
}: {
  scene: PrototypeScene;
  mode: RenderingStudyProps["mode"];
  dark: boolean;
  view: ViewState;
  setView: Dispatch<SetStateAction<ViewState>>;
  resetView: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const families = useMemo(
    () => scene.manifest.routeFamilies.filter((family) => !family.routeIds.includes("SI")),
    [scene.manifest.routeFamilies],
  );
  const laneShapes = useMemo(
    () => (mode === "lanes" ? buildLaneShapes(scene.detail.shapes, families) : []),
    [families, mode, scene.detail.shapes],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width < 2 || size.height < 2) return;
    const context = resizeCanvas(canvas, size.width, size.height);
    if (!context) return;
    const colors = dark ? palette.dark : palette.light;
    const transform = mapTransform(size.width, size.height, view);
    const fontFamily = getComputedStyle(canvas).fontFamily;

    context.clearRect(0, 0, size.width, size.height);
    context.fillStyle = colors.water;
    context.fillRect(0, 0, size.width, size.height);
    context.save();
    applyMapTransform(context, transform);
    drawBaseMap(context, scene.map, colors, transform, fontFamily);
    if (mode === "reference") {
      drawReferenceLines(context, scene, colors, transform);
    } else if (mode === "bands") {
      drawBandLines(context, scene, families, colors, transform);
    } else {
      drawLaneLines(context, laneShapes, families, colors, transform);
    }
    drawLabels(context, scene.map, colors, transform, fontFamily);
    context.restore();
  }, [dark, families, laneShapes, mode, scene, size.height, size.width, view]);

  const zoomAround = useCallback(
    (requestedZoom: number, point?: Point) => {
      setView((current) => {
        const zoom = clamp(requestedZoom, MIN_ZOOM, MAX_ZOOM);
        const focal = point ?? { x: size.width / 2, y: size.height / 2 };
        const x = focal.x - size.width / 2;
        const y = focal.y - size.height / 2;
        const ratio = zoom / current.zoom;
        return {
          zoom,
          panX: x - (x - current.panX) * ratio,
          panY: y - (y - current.panY) * ratio,
        };
      });
    },
    [setView, size.height, size.width],
  );

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      const multiplier = event.ctrlKey ? 0.008 : 0.0015;
      zoomAround(view.zoom * Math.exp(-event.deltaY * multiplier), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [view.zoom, zoomAround]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.focus({ preventScroll: true });
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      panX: view.panX,
      panY: view.panY,
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || view.zoom <= 1) return;
    setView((current) => ({
      ...current,
      panX: drag.panX + event.clientX - drag.x,
      panY: drag.panY + event.clientY - drag.y,
    }));
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      ref={containerRef}
      className={styles.mapViewport}
      role="region"
      tabIndex={0}
      aria-label="Rendering study map. Pinch or scroll to zoom, drag to move, double-click to zoom in, or press zero to reset."
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onDoubleClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        zoomAround(view.zoom * 1.35, {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
      }}
      onKeyDown={(event) => {
        if (event.key === "+" || event.key === "=") zoomAround(view.zoom * 1.35);
        else if (event.key === "-") zoomAround(view.zoom / 1.35);
        else if (event.key === "0") resetView();
        else return;
        event.preventDefault();
      }}
    >
      <canvas ref={canvasRef} className={styles.mapCanvas} aria-hidden="true" />
    </div>
  );
}

function ThemeIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 7v5h5M5.5 16.5A8 8 0 1 0 6 6l-2 2" />
    </svg>
  );
}

export function RenderingStudy({
  scene,
  loadError,
  dark,
  view,
  setView,
  resetView,
  toggleTheme,
  mode,
  eyebrow,
  title,
  description,
  geometryLabel,
  overlapLabel,
}: RenderingStudyProps) {
  const families =
    scene?.manifest.routeFamilies.filter(
      (family) => !family.routeIds.includes("SI"),
    ) ?? [];

  return (
    <main className={styles.experience} data-theme={dark ? "dark" : "light"}>
      <aside className={styles.rail}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </div>

        <dl className={styles.metrics}>
          <div>
            <dt>Geometry</dt>
            <dd>{geometryLabel}</dd>
          </div>
          <div>
            <dt>Overlap</dt>
            <dd>{overlapLabel}</dd>
          </div>
        </dl>

        <div className={styles.legend} aria-label="Subway color families">
          {families.map((family) => (
            <div className={styles.legendRow} key={family.color}>
              <span
                className={styles.legendMark}
                style={{ "--route-color": family.color } as CSSProperties}
                aria-hidden="true"
              />
              <span>{family.labels.join(" ")}</span>
            </div>
          ))}
        </div>

        <div className={styles.controls}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label={dark ? "Use light appearance" : "Use dark appearance"}
            onClick={toggleTheme}
          >
            <ThemeIcon dark={dark} />
          </button>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Reset map view"
            onClick={resetView}
            disabled={view.zoom === 1 && view.panX === 0 && view.panY === 0}
          >
            <ResetIcon />
          </button>
        </div>

        <p className={styles.disclosure}>
          Pinch or scroll to inspect curves. Use 1–3 or the picker to compare
          treatments. Prototype only; production is unchanged.
        </p>
      </aside>

      <section className={styles.mapPanel} aria-label={`${title} map rendering`}>
        {scene ? (
          <NetworkCanvas
            scene={scene}
            mode={mode}
            dark={dark}
            view={view}
            setView={setView}
            resetView={resetView}
          />
        ) : (
          <div className={styles.loading} role={loadError ? "alert" : "status"}>
            {loadError ?? "Preparing rendering study"}
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getNewYorkClock, sampleScheduledTrip } from "@/lib/subway/schedule";
import type {
  RouteDefinition,
  ScheduleChunk,
  SubwayMapData,
} from "@/lib/subway/types";
import styles from "../page.module.css";

export type ServiceContext = {
  serviceId: string;
  dayOffset: 0 | 1;
};

export type LoadedScene = {
  map: SubwayMapData;
  schedules: Map<string, ScheduleChunk>;
  contexts: ServiceContext[];
};

export type SceneStats = {
  total: number;
  byRoute: Record<string, number>;
};

export type ModelClock = {
  serviceDate: string;
  seconds: number;
  replay: boolean;
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
    inset: "rgba(253, 252, 249, 0.82)",
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
    inset: "rgba(13, 15, 18, 0.96)",
  },
} as const;

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const ZOOM_STEP = 1.35;

type ViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

type Point = {
  x: number;
  y: number;
};

type Gesture =
  | {
      kind: "drag";
      pointerId: number;
      start: Point;
      startPan: Point;
    }
  | {
      kind: "pinch";
      pointerIds: [number, number];
      startDistance: number;
      startZoom: number;
      worldPoint: Point;
    };

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointDistance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointMidpoint(first: Point, second: Point) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
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

function mapTransform(width: number, height: number, map: SubwayMapData) {
  const mobile = width < 640;
  const view = mobile
    ? { x: 235, y: 88, width: 555, height: 720 }
    : { x: 0, y: 0, width: map.viewBox[0], height: map.viewBox[1] };
  const scale = Math.min(width / view.width, height / view.height);
  return {
    scale,
    x: (width - view.width * scale) / 2 - view.x * scale,
    y: (height - view.height * scale) / 2 - view.y * scale,
  };
}

function applyMapTransform(
  context: CanvasRenderingContext2D,
  transform: ReturnType<typeof mapTransform>,
) {
  context.translate(transform.x, transform.y);
  context.scale(transform.scale, transform.scale);
}

function traceShape(context: CanvasRenderingContext2D, points: readonly number[]) {
  context.beginPath();
  context.moveTo(points[0], points[1]);
  for (let index = 2; index < points.length; index += 2) {
    context.lineTo(points[index], points[index + 1]);
  }
}

function drawStaticMap(
  canvas: HTMLCanvasElement,
  map: SubwayMapData,
  routes: readonly RouteDefinition[],
  dark: boolean,
  width: number,
  height: number,
) {
  const context = resizeCanvas(canvas, width, height);
  if (!context) return;
  const colors = dark ? palette.dark : palette.light;
  const transform = mapTransform(width, height, map);
  const mobile = width < 640;
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const strokeWidth = (value: number) => value / transform.scale;
  const fontFamily = getComputedStyle(canvas).fontFamily;

  context.clearRect(0, 0, width, height);
  context.fillStyle = colors.water;
  context.fillRect(0, 0, width, height);
  context.save();
  applyMapTransform(context, transform);

  context.fillStyle = colors.land;
  context.strokeStyle = colors.hairline;
  context.lineWidth = strokeWidth(1);
  for (const borough of map.boroughs) {
    const path = new Path2D(borough.path);
    context.fill(path, "evenodd");
    context.stroke(path);
  }

  if (!mobile) {
    context.fillStyle = colors.inset;
    const inset = new Path2D(
      "M32 606H260A12 12 0 0 1 272 618V778A12 12 0 0 1 260 790H32A12 12 0 0 1 20 778V618A12 12 0 0 1 32 606Z",
    );
    context.fill(inset);
    context.stroke(inset);
    const statenIsland = new Path2D(map.statenIsland.path);
    context.fillStyle = colors.land;
    context.fill(statenIsland, "evenodd");
    context.stroke(statenIsland);
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
  if (!mobile) {
    context.lineWidth = strokeWidth(0.8);
    context.stroke(new Path2D(map.streets.statenIsland));
  }

  context.strokeStyle = colors.casing;
  context.lineWidth = strokeWidth(8.5);
  for (const shape of map.shapes) {
    if (mobile && shape.routeId === "SI") continue;
    traceShape(context, shape.points);
    context.stroke();
  }
  context.lineWidth = strokeWidth(5);
  for (const shape of map.shapes) {
    if (mobile && shape.routeId === "SI") continue;
    const route = routeById.get(shape.routeId);
    if (!route) continue;
    context.strokeStyle = route.color;
    traceShape(context, shape.points);
    context.stroke();
  }

  context.textBaseline = "middle";
  context.fillStyle = colors.faint;
  context.textAlign = "center";
  context.font = `650 ${11 / transform.scale}px ${fontFamily}`;
  for (const borough of map.boroughs) {
    context.fillText(borough.name.toUpperCase(), borough.label.x, borough.label.y);
  }
  if (!mobile) {
    context.textAlign = "left";
    context.font = `650 ${10 / transform.scale}px ${fontFamily}`;
    context.fillText("STATEN ISLAND", 33, 625);
    context.fillStyle = colors.muted;
    context.font = `500 ${8.5 / transform.scale}px ${fontFamily}`;
    context.fillText("geographic inset", 33, 642);
  }

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
    const lineX = landmark.x + (landmark.dx * 0.72) / transform.scale;
    const lineY = landmark.y + (landmark.dy * 0.72) / transform.scale;
    context.beginPath();
    context.moveTo(landmark.x, landmark.y);
    context.lineTo(lineX, lineY);
    context.strokeStyle = colors.muted;
    context.lineWidth = strokeWidth(0.55);
    context.stroke();
    context.textAlign = landmark.anchor === "middle" ? "center" : landmark.anchor;
    context.strokeStyle = colors.land;
    context.lineWidth = strokeWidth(3.5);
    context.strokeText(landmark.label, x, y);
    context.fillText(landmark.label, x, y);
  }
  context.restore();
}

function drawTrains(
  canvas: HTMLCanvasElement,
  scene: LoadedScene,
  routes: readonly RouteDefinition[],
  width: number,
  height: number,
  seconds: number,
) {
  const context = resizeCanvas(canvas, width, height);
  if (!context) return { total: 0, byRoute: {} };
  const transform = mapTransform(width, height, scene.map);
  const mobile = width < 640;
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const fontFamily = getComputedStyle(canvas).fontFamily;
  const byRoute: Record<string, number> = {};
  let total = 0;

  context.clearRect(0, 0, width, height);
  context.save();
  applyMapTransform(context, transform);
  context.textAlign = "center";
  context.textBaseline = "middle";

  for (const service of scene.contexts) {
    const schedule = scene.schedules.get(service.serviceId);
    if (!schedule) continue;
    const serviceSeconds = seconds + service.dayOffset * 86_400;

    for (const trip of schedule.trips) {
      if (trip.startSeconds > serviceSeconds) break;
      if (trip.endSeconds < serviceSeconds) continue;
      const shape = scene.map.shapes[trip.shapeIndex];
      const route = routeById.get(trip.routeId);
      if (!shape || !route) continue;
      if (mobile && route.id === "SI") continue;
      const position = sampleScheduledTrip(trip, shape, serviceSeconds);
      if (!position) continue;

      context.beginPath();
      context.arc(
        position.x,
        position.y,
        (mobile ? 7.1 : 7.8) / transform.scale,
        0,
        Math.PI * 2,
      );
      context.fillStyle = route.color;
      context.fill();
      context.fillStyle = route.textColor;
      const fontSize =
        (route.label.length > 1 ? 6.5 : mobile ? 8.5 : 9.5) / transform.scale;
      context.font = `700 ${fontSize}px ${fontFamily}`;
      context.fillText(route.label, position.x, position.y + 0.25 / transform.scale);
      total += 1;
      byRoute[route.id] = (byRoute[route.id] ?? 0) + 1;
    }
  }

  context.restore();
  return { total, byRoute };
}

function useCanvasSize(containerRef: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      setSize((current) =>
        current.width === width && current.height === height
          ? current
          : { width, height },
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef]);

  return size;
}

export function TransitMap({
  scene,
  routes,
  dark,
  isPlaying,
  modelClock,
  onStats,
}: {
  scene: LoadedScene | null;
  routes: RouteDefinition[];
  dark: boolean;
  isPlaying: boolean;
  modelClock: ModelClock;
  onStats: (stats: SceneStats) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportLayerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const trainCanvasRef = useRef<HTMLCanvasElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);
  const zoomOutRef = useRef<HTMLButtonElement>(null);
  const zoomResetRef = useRef<HTMLButtonElement>(null);
  const zoomInRef = useRef<HTMLButtonElement>(null);
  const size = useCanvasSize(containerRef);
  const clockRef = useRef({ seconds: modelClock.seconds, capturedAt: 0 });
  const statsRef = useRef({ signature: "", reportedAt: 0 });
  const viewRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const reducedSnapshotMinute = isPlaying
    ? 0
    : Math.floor(modelClock.seconds / 60);

  const constrainView = useCallback(
    (view: ViewState): ViewState => {
      const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
      const maximumPanX = (size.width * (zoom - 1)) / 2;
      const maximumPanY = (size.height * (zoom - 1)) / 2;
      return {
        zoom,
        panX: clamp(view.panX, -maximumPanX, maximumPanX),
        panY: clamp(view.panY, -maximumPanY, maximumPanY),
      };
    },
    [size.height, size.width],
  );

  const applyView = useCallback(
    (candidate: ViewState) => {
      const view = constrainView(candidate);
      viewRef.current = view;
      const layer = viewportLayerRef.current;
      if (layer) {
        layer.style.transform =
          view.zoom === 1
            ? "none"
            : `translate3d(${view.panX.toFixed(2)}px, ${view.panY.toFixed(2)}px, 0) scale(${view.zoom.toFixed(4)})`;
      }
      const percentage = Math.round(view.zoom * 100);
      if (zoomLabelRef.current) {
        zoomLabelRef.current.textContent = `${percentage}%`;
      }
      if (zoomOutRef.current) zoomOutRef.current.disabled = view.zoom <= MIN_ZOOM;
      if (zoomResetRef.current) zoomResetRef.current.disabled = view.zoom <= MIN_ZOOM;
      if (zoomInRef.current) zoomInRef.current.disabled = view.zoom >= MAX_ZOOM;
      if (containerRef.current) {
        containerRef.current.dataset.zoomed = String(view.zoom > MIN_ZOOM);
      }
    },
    [constrainView],
  );

  const pointFromClient = (clientX: number, clientY: number): Point => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: clientX - bounds.left - bounds.width / 2,
      y: clientY - bounds.top - bounds.height / 2,
    };
  };

  const zoomAround = (nextZoom: number, focalPoint: Point = { x: 0, y: 0 }) => {
    const current = viewRef.current;
    const zoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const worldPoint = {
      x: (focalPoint.x - current.panX) / current.zoom,
      y: (focalPoint.y - current.panY) / current.zoom,
    };
    applyView({
      zoom,
      panX: focalPoint.x - worldPoint.x * zoom,
      panY: focalPoint.y - worldPoint.y * zoom,
    });
  };

  const panBy = (x: number, y: number) => {
    const current = viewRef.current;
    applyView({
      ...current,
      panX: current.panX + x,
      panY: current.panY + y,
    });
  };

  const resetView = () => applyView({ zoom: 1, panX: 0, panY: 0 });

  const beginPinch = () => {
    const pointers = [...pointersRef.current.entries()].slice(0, 2);
    if (pointers.length < 2) return;
    const [[firstId, first], [secondId, second]] = pointers;
    const midpoint = pointMidpoint(first, second);
    const current = viewRef.current;
    gestureRef.current = {
      kind: "pinch",
      pointerIds: [firstId, secondId],
      startDistance: Math.max(pointDistance(first, second), 1),
      startZoom: current.zoom,
      worldPoint: {
        x: (midpoint.x - current.panX) / current.zoom,
        y: (midpoint.y - current.panY) / current.zoom,
      },
    };
    if (containerRef.current) containerRef.current.dataset.dragging = "true";
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType === "mouse" &&
      (!event.isPrimary || event.button !== 0)
    ) {
      return;
    }
    const point = pointFromClient(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse") {
      event.currentTarget.focus({ preventScroll: true });
    }
    if (pointersRef.current.size >= 2) {
      beginPinch();
      return;
    }
    if (viewRef.current.zoom > MIN_ZOOM) {
      gestureRef.current = {
        kind: "drag",
        pointerId: event.pointerId,
        start: point,
        startPan: {
          x: viewRef.current.panX,
          y: viewRef.current.panY,
        },
      };
      if (containerRef.current) containerRef.current.dataset.dragging = "true";
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;
    const point = pointFromClient(event.clientX, event.clientY);
    pointersRef.current.set(event.pointerId, point);
    const gesture = gestureRef.current;
    if (!gesture) return;
    event.preventDefault();

    if (gesture.kind === "drag" && gesture.pointerId === event.pointerId) {
      applyView({
        ...viewRef.current,
        panX: gesture.startPan.x + point.x - gesture.start.x,
        panY: gesture.startPan.y + point.y - gesture.start.y,
      });
      return;
    }

    if (gesture.kind === "pinch") {
      const first = pointersRef.current.get(gesture.pointerIds[0]);
      const second = pointersRef.current.get(gesture.pointerIds[1]);
      if (!first || !second) return;
      const midpoint = pointMidpoint(first, second);
      const zoom = clamp(
        gesture.startZoom *
          (pointDistance(first, second) / gesture.startDistance),
        MIN_ZOOM,
        MAX_ZOOM,
      );
      applyView({
        zoom,
        panX: midpoint.x - gesture.worldPoint.x * zoom,
        panY: midpoint.y - gesture.worldPoint.y * zoom,
      });
    }
  };

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    const remaining = [...pointersRef.current.entries()][0];
    if (remaining && viewRef.current.zoom > MIN_ZOOM) {
      gestureRef.current = {
        kind: "drag",
        pointerId: remaining[0],
        start: remaining[1],
        startPan: {
          x: viewRef.current.panX,
          y: viewRef.current.panY,
        },
      };
      return;
    }
    gestureRef.current = null;
    if (containerRef.current) containerRef.current.dataset.dragging = "false";
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const focalPoint = pointFromClient(event.clientX, event.clientY);
    zoomAround(
      viewRef.current.zoom * Math.exp(-event.deltaY * 0.0015),
      focalPoint,
    );
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (key === "+" || key === "=") {
      zoomAround(viewRef.current.zoom * ZOOM_STEP);
    } else if (key === "-") {
      zoomAround(viewRef.current.zoom / ZOOM_STEP);
    } else if (key === "0") {
      resetView();
    } else if (key === "ArrowLeft") {
      panBy(48, 0);
    } else if (key === "ArrowRight") {
      panBy(-48, 0);
    } else if (key === "ArrowUp") {
      panBy(0, 48);
    } else if (key === "ArrowDown") {
      panBy(0, -48);
    } else {
      return;
    }
    event.preventDefault();
  };

  useEffect(() => {
    clockRef.current = {
      seconds: modelClock.seconds,
      capturedAt: performance.now(),
    };
  }, [modelClock.seconds, modelClock.serviceDate]);

  useEffect(() => {
    applyView(viewRef.current);
  }, [applyView]);

  useEffect(() => {
    if (!scene || !staticCanvasRef.current || size.width < 2 || size.height < 2) {
      return;
    }
    drawStaticMap(
      staticCanvasRef.current,
      scene.map,
      routes,
      dark,
      size.width,
      size.height,
    );
  }, [dark, routes, scene, size.height, size.width]);

  useEffect(() => {
    const canvas = trainCanvasRef.current;
    if (!scene || !canvas || size.width < 2 || size.height < 2) return;
    let animationFrame = 0;

    const draw = (frameTime: number) => {
      const elapsed = isPlaying
        ? Math.max(0, frameTime - clockRef.current.capturedAt) / 1_000
        : 0;
      const nextStats = drawTrains(
        canvas,
        scene,
        routes,
        size.width,
        size.height,
        clockRef.current.seconds + elapsed,
      );
      const signature = `${nextStats.total}:${Object.entries(nextStats.byRoute)
        .map(([route, count]) => `${route}${count}`)
        .join("|")}`;
      if (
        signature !== statsRef.current.signature &&
        frameTime - statsRef.current.reportedAt > 500
      ) {
        statsRef.current = { signature, reportedAt: frameTime };
        onStats(nextStats);
      }
      if (isPlaying) animationFrame = requestAnimationFrame(draw);
    };

    if (isPlaying) animationFrame = requestAnimationFrame(draw);
    else draw(performance.now());

    const handleVisibility = () => {
      if (!document.hidden && isPlaying && !animationFrame) {
        clockRef.current = {
          seconds: getNewYorkClock().seconds,
          capturedAt: performance.now(),
        };
        animationFrame = requestAnimationFrame(draw);
      } else if (document.hidden && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [
    isPlaying,
    onStats,
    reducedSnapshotMinute,
    routes,
    scene,
    size.height,
    size.width,
  ]);

  return (
    <div
      className={styles.canvasStack}
      ref={containerRef}
      data-zoomed="false"
      data-dragging="false"
    >
      <div
        className={styles.mapViewportLayer}
        ref={viewportLayerRef}
        role="region"
        tabIndex={0}
        aria-label="Interactive subway map. Use the zoom controls, plus and minus keys, arrow keys to move, or zero to reset."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onDoubleClick={(event) =>
          zoomAround(
            viewRef.current.zoom * ZOOM_STEP,
            pointFromClient(event.clientX, event.clientY),
          )
        }
      >
        <canvas
          className={styles.mapCanvas}
          ref={staticCanvasRef}
          aria-hidden="true"
        />
        <canvas
          className={styles.trainCanvas}
          ref={trainCanvasRef}
          role="img"
          aria-label="Animated scheduled subway trains moving across a generalized map of New York City"
        />
      </div>
      <div className={styles.zoomHud}>
        <span className={styles.zoomHint} aria-hidden="true">
          Scroll to zoom · drag to move
        </span>
        <div className={styles.zoomControls} role="group" aria-label="Map zoom">
          <button
            className={styles.zoomButton}
            ref={zoomOutRef}
            type="button"
            aria-label="Zoom out"
            onClick={() => zoomAround(viewRef.current.zoom / ZOOM_STEP)}
          >
            <span aria-hidden="true">−</span>
          </button>
          <button
            className={styles.zoomReset}
            ref={zoomResetRef}
            type="button"
            aria-label="Reset map view"
            onClick={resetView}
          >
            <span ref={zoomLabelRef} data-initial-label="100%" />
          </button>
          <button
            className={styles.zoomButton}
            ref={zoomInRef}
            type="button"
            aria-label="Zoom in"
            onClick={() => zoomAround(viewRef.current.zoom * ZOOM_STEP)}
          >
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}

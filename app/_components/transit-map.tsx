"use client";

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getNewYorkClock,
  sampleScheduledTrip,
  shapePointsBetweenDistances,
} from "@/lib/subway/schedule";
import { shapePointAtIndex } from "@/lib/subway/lane-geometry";
import { canvasPixelRatio } from "@/lib/subway/canvas";
import type {
  RouteDefinition,
  RouteFamily,
  ScheduleChunk,
  ShapeDefinition,
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
const ZOOM_STEP = 1.35;
const VIEW_SETTLE_DELAY = 90;
const REBASE_ZOOM_IN_RATIO = 1.12;
const REBASE_ZOOM_OUT_RATIO = 0.94;
const REBASE_PAN_DISTANCE = 48;
const TRAIN_DIRECTION_STEM_LENGTH = 15;
const TRAIN_MOTION_SAMPLE_SECONDS = 5;
const ROUTE_LANE_SPACING = 4.7;

type ViewState = {
  zoom: number;
  panX: number;
  panY: number;
};

type Point = {
  x: number;
  y: number;
};

type AnimationClock = {
  serviceDate: string;
  replay: boolean;
  seconds: number;
  capturedAt: number;
};

type SafariGestureEvent = Event & {
  clientX?: number;
  clientY?: number;
  scale: number;
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

function clockSecondsAt(
  clock: AnimationClock,
  frameTime: number,
  isPlaying: boolean,
) {
  const elapsed =
    isPlaying && clock.capturedAt > 0
      ? Math.max(0, frameTime - clock.capturedAt) / 1_000
      : 0;
  return clock.seconds + elapsed;
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
) {
  const ratio = canvasPixelRatio(
    width,
    height,
    window.devicePixelRatio || 1,
  );
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

function mapTransform(
  width: number,
  height: number,
  camera: ViewState,
) {
  const mobile = width < 640;
  const view = mobile
    ? { x: 235, y: 88, width: 555, height: 720 }
    : { x: 280, y: 20, width: 640, height: 780 };
  const baseScale = Math.min(width / view.width, height / view.height);
  const baseX = (width - view.width * baseScale) / 2 - view.x * baseScale;
  const baseY = (height - view.height * baseScale) / 2 - view.y * baseScale;
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
  shape: ShapeDefinition,
  laneSpacing: number,
) {
  const pointCount = shape.points.length / 2;
  if (pointCount < 2) return;
  const first = shapePointAtIndex(shape, 0, laneSpacing);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (let index = 1; index < pointCount; index += 1) {
    const point = shapePointAtIndex(shape, index, laneSpacing);
    context.lineTo(point.x, point.y);
  }
}

function drawStaticMap(
  canvas: HTMLCanvasElement,
  map: SubwayMapData,
  routes: readonly RouteDefinition[],
  routeFamilies: readonly RouteFamily[],
  visibleRouteIds: ReadonlySet<string> | null,
  dark: boolean,
  width: number,
  height: number,
  camera: ViewState,
) {
  const context = resizeCanvas(canvas, width, height);
  if (!context) return;
  const colors = dark ? palette.dark : palette.light;
  const transform = mapTransform(width, height, camera);
  const routeById = new Map(routes.map((route) => [route.id, route]));
  const strokeWidth = (value: number) => value / transform.scale;
  const laneSpacing = ROUTE_LANE_SPACING / transform.scale;
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
  const shapesByRoute = new Map<string, ShapeDefinition[]>();
  for (const shape of map.shapes) {
    if (shape.routeId === "SI") continue;
    if (visibleRouteIds && !visibleRouteIds.has(shape.routeId)) continue;
    if (!routeById.has(shape.routeId)) continue;
    const routeShapes = shapesByRoute.get(shape.routeId) ?? [];
    routeShapes.push(shape);
    shapesByRoute.set(shape.routeId, routeShapes);
  }

  for (const family of routeFamilies) {
    const familyShapes = family.routeIds.flatMap(
      (routeId) => shapesByRoute.get(routeId) ?? [],
    );
    context.strokeStyle = colors.casing;
    context.lineWidth = strokeWidth(4.4);
    for (const shape of familyShapes) {
      traceShape(context, shape, laneSpacing);
      context.stroke();
    }
    context.strokeStyle = family.color;
    context.lineWidth = strokeWidth(2.6);
    for (const shape of familyShapes) {
      traceShape(context, shape, laneSpacing);
      context.stroke();
    }
  }

  context.textBaseline = "middle";
  context.fillStyle = colors.faint;
  context.textAlign = "center";
  context.font = `650 ${11 / transform.scale}px ${fontFamily}`;
  for (const borough of map.boroughs) {
    context.fillText(borough.name.toUpperCase(), borough.label.x, borough.label.y);
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
  visibleRouteIds: ReadonlySet<string> | null,
  width: number,
  height: number,
  seconds: number,
  camera: ViewState,
) {
  const context = resizeCanvas(canvas, width, height);
  if (!context) return { total: 0, byRoute: {} };
  const mobile = width < 640;
  const transform = mapTransform(width, height, camera);
  const laneSpacing = ROUTE_LANE_SPACING / transform.scale;
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
      const position = sampleScheduledTrip(
        trip,
        shape,
        serviceSeconds,
        laneSpacing,
      );
      if (!position) continue;
      total += 1;
      byRoute[route.id] = (byRoute[route.id] ?? 0) + 1;
      if (visibleRouteIds && !visibleRouteIds.has(route.id)) continue;

      const recentPosition = sampleScheduledTrip(
        trip,
        shape,
        Math.max(trip.startSeconds, serviceSeconds - TRAIN_MOTION_SAMPLE_SECONDS),
        laneSpacing,
      );
      const recentDistance = recentPosition
        ? Math.hypot(
            position.x - recentPosition.x,
            position.y - recentPosition.y,
          ) * transform.scale
        : 0;
      if (recentDistance > 0.15) {
        const stemPoints = shapePointsBetweenDistances(
          shape,
          Math.max(
            0,
            position.distance - TRAIN_DIRECTION_STEM_LENGTH / transform.scale,
          ),
          position.distance,
          laneSpacing,
        );
        if (stemPoints.length > 1) {
          context.save();
          context.globalAlpha = 0.58;
          context.strokeStyle = route.color;
          context.lineWidth = 5.2 / transform.scale;
          context.lineCap = "round";
          context.lineJoin = "round";
          context.beginPath();
          context.moveTo(stemPoints[0].x, stemPoints[0].y);
          for (let index = 1; index < stemPoints.length; index += 1) {
            context.lineTo(stemPoints[index].x, stemPoints[index].y);
          }
          context.stroke();
          context.globalAlpha = 0.72;
          context.strokeStyle = route.textColor;
          context.lineWidth = 0.9 / transform.scale;
          context.stroke();
          context.restore();
        }
      }

      context.beginPath();
      context.arc(
        position.x,
        position.y,
        (mobile ? 6.1 : 6.5) / transform.scale,
        0,
        Math.PI * 2,
      );
      context.fillStyle = route.color;
      context.fill();
      context.fillStyle = route.textColor;
      const fontSize =
        (route.label.length > 1 ? 5.8 : mobile ? 7.7 : 8.3) / transform.scale;
      context.font = `700 ${fontSize}px ${fontFamily}`;
      context.fillText(route.label, position.x, position.y + 0.25 / transform.scale);
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
  routeFamilies,
  visibleRouteIds,
  dark,
  isPlaying,
  modelClock,
  onStats,
}: {
  scene: LoadedScene | null;
  routes: RouteDefinition[];
  routeFamilies: RouteFamily[];
  visibleRouteIds: ReadonlySet<string> | null;
  dark: boolean;
  isPlaying: boolean;
  modelClock: ModelClock;
  onStats: (stats: SceneStats) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportLayerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const trainCanvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef);
  const clockRef = useRef<AnimationClock>({
    serviceDate: "",
    replay: false,
    seconds: modelClock.seconds,
    capturedAt: 0,
  });
  const statsRef = useRef({ signature: "", reportedAt: 0 });
  const viewRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const committedViewRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 });
  const pointersRef = useRef(new Map<number, Point>());
  const gestureRef = useRef<Gesture | null>(null);
  const safariGestureRef = useRef<{
    startZoom: number;
    focalPoint: Point;
  } | null>(null);
  const commitTimerRef = useRef<number | null>(null);
  const renderInputsRef = useRef({
    scene,
    routes,
    routeFamilies,
    visibleRouteIds,
    dark,
    size,
    isPlaying,
  });
  const reducedSnapshotMinute = isPlaying
    ? 0
    : Math.floor(modelClock.seconds / 60);

  useEffect(() => {
    renderInputsRef.current = {
      scene,
      routes,
      routeFamilies,
      visibleRouteIds,
      dark,
      size,
      isPlaying,
    };
  }, [dark, isPlaying, routeFamilies, routes, scene, size, visibleRouteIds]);

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

  const commitView = useCallback(() => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const view = viewRef.current;
    const inputs = renderInputsRef.current;
    committedViewRef.current = view;

    if (
      inputs.scene &&
      staticCanvasRef.current &&
      trainCanvasRef.current &&
      inputs.size.width > 1 &&
      inputs.size.height > 1
    ) {
      drawStaticMap(
        staticCanvasRef.current,
        inputs.scene.map,
        inputs.routes,
        inputs.routeFamilies,
        inputs.visibleRouteIds,
        inputs.dark,
        inputs.size.width,
        inputs.size.height,
        view,
      );
      const frameTime = performance.now();
      drawTrains(
        trainCanvasRef.current,
        inputs.scene,
        inputs.routes,
        inputs.visibleRouteIds,
        inputs.size.width,
        inputs.size.height,
        clockSecondsAt(clockRef.current, frameTime, inputs.isPlaying),
        view,
      );
    }

    if (viewportLayerRef.current) {
      viewportLayerRef.current.style.transform = "none";
    }
  }, []);

  const scheduleViewCommit = useCallback((delay = VIEW_SETTLE_DELAY) => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(commitView, delay);
  }, [commitView]);

  const applyView = useCallback(
    (candidate: ViewState) => {
      const view = constrainView(candidate);
      viewRef.current = view;
      const committed = committedViewRef.current;
      const relativeZoom = view.zoom / committed.zoom;
      const relativePanX = view.panX - relativeZoom * committed.panX;
      const relativePanY = view.panY - relativeZoom * committed.panY;
      const isCommitted =
        Math.abs(relativeZoom - 1) < 0.0001 &&
        Math.abs(relativePanX) < 0.01 &&
        Math.abs(relativePanY) < 0.01;
      const layer = viewportLayerRef.current;
      if (layer) {
        layer.style.transform =
          isCommitted
            ? "none"
            : `translate3d(${relativePanX.toFixed(2)}px, ${relativePanY.toFixed(2)}px, 0) scale(${relativeZoom.toFixed(4)})`;
      }
      if (containerRef.current) {
        containerRef.current.dataset.zoomed = String(view.zoom > MIN_ZOOM);
      }
      if (!isCommitted) {
        const shouldRebase =
          relativeZoom >= REBASE_ZOOM_IN_RATIO ||
          relativeZoom <= REBASE_ZOOM_OUT_RATIO ||
          Math.abs(relativePanX) >= REBASE_PAN_DISTANCE ||
          Math.abs(relativePanY) >= REBASE_PAN_DISTANCE ||
          view.zoom === MIN_ZOOM ||
          view.zoom === MAX_ZOOM;
        scheduleViewCommit(shouldRebase ? 0 : VIEW_SETTLE_DELAY);
      }
    },
    [constrainView, scheduleViewCommit],
  );

  const pointFromClient = useCallback((clientX: number, clientY: number): Point => {
    const bounds = containerRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: clientX - bounds.left - bounds.width / 2,
      y: clientY - bounds.top - bounds.height / 2,
    };
  }, []);

  const zoomAround = useCallback(
    (nextZoom: number, focalPoint: Point = { x: 0, y: 0 }) => {
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
    },
    [applyView],
  );

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

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (safariGestureRef.current) return;
      const deltaMultiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? size.height
            : 1;
      const zoomIntensity = event.ctrlKey ? 0.008 : 0.0015;
      const focalPoint = pointFromClient(event.clientX, event.clientY);
      zoomAround(
        viewRef.current.zoom *
          Math.exp(-event.deltaY * deltaMultiplier * zoomIntensity),
        focalPoint,
      );
    },
    [pointFromClient, size.height, zoomAround],
  );

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
    const element = viewportLayerRef.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    const element = viewportLayerRef.current;
    if (!element || navigator.maxTouchPoints > 0) return;

    const focalPointFor = (event: SafariGestureEvent) =>
      typeof event.clientX === "number" && typeof event.clientY === "number"
        ? pointFromClient(event.clientX, event.clientY)
        : { x: 0, y: 0 };
    const handleGestureStart = (rawEvent: Event) => {
      const event = rawEvent as SafariGestureEvent;
      event.preventDefault();
      safariGestureRef.current = {
        startZoom: viewRef.current.zoom,
        focalPoint: focalPointFor(event),
      };
      if (containerRef.current) {
        containerRef.current.dataset.dragging = "true";
      }
    };
    const handleGestureChange = (rawEvent: Event) => {
      const event = rawEvent as SafariGestureEvent;
      const gesture = safariGestureRef.current;
      if (!gesture || !Number.isFinite(event.scale)) return;
      event.preventDefault();
      zoomAround(gesture.startZoom * event.scale, gesture.focalPoint);
    };
    const handleGestureEnd = (event: Event) => {
      event.preventDefault();
      safariGestureRef.current = null;
      if (containerRef.current) {
        containerRef.current.dataset.dragging = "false";
      }
      commitView();
    };

    element.addEventListener("gesturestart", handleGestureStart, {
      passive: false,
    });
    element.addEventListener("gesturechange", handleGestureChange, {
      passive: false,
    });
    element.addEventListener("gestureend", handleGestureEnd, {
      passive: false,
    });
    return () => {
      element.removeEventListener("gesturestart", handleGestureStart);
      element.removeEventListener("gesturechange", handleGestureChange);
      element.removeEventListener("gestureend", handleGestureEnd);
    };
  }, [commitView, pointFromClient, zoomAround]);

  useEffect(() => {
    const clock = clockRef.current;
    const shouldAnchor =
      modelClock.serviceDate &&
      (clock.capturedAt === 0 ||
        clock.serviceDate !== modelClock.serviceDate ||
        clock.replay !== modelClock.replay);
    if (!shouldAnchor) return;

    clockRef.current = {
      serviceDate: modelClock.serviceDate,
      replay: modelClock.replay,
      seconds: modelClock.seconds,
      capturedAt: performance.now(),
    };
  }, [modelClock.replay, modelClock.seconds, modelClock.serviceDate]);

  useEffect(() => {
    applyView(viewRef.current);
    commitView();
  }, [applyView, commitView]);

  useEffect(
    () => () => {
      if (commitTimerRef.current) {
        window.clearTimeout(commitTimerRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!scene || !staticCanvasRef.current || size.width < 2 || size.height < 2) {
      return;
    }
    drawStaticMap(
      staticCanvasRef.current,
      scene.map,
      routes,
      routeFamilies,
      visibleRouteIds,
      dark,
      size.width,
      size.height,
      committedViewRef.current,
    );
  }, [
    dark,
    routeFamilies,
    routes,
    scene,
    size.height,
    size.width,
    visibleRouteIds,
  ]);

  useEffect(() => {
    const canvas = trainCanvasRef.current;
    if (!scene || !canvas || size.width < 2 || size.height < 2) return;
    let animationFrame = 0;

    const draw = (frameTime: number) => {
      const nextStats = drawTrains(
        canvas,
        scene,
        routes,
        visibleRouteIds,
        size.width,
        size.height,
        clockSecondsAt(clockRef.current, frameTime, isPlaying),
        committedViewRef.current,
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
        const now = new Date();
        const currentClock = getNewYorkClock(now);
        clockRef.current = {
          ...clockRef.current,
          seconds: currentClock.seconds + now.getMilliseconds() / 1_000,
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
    visibleRouteIds,
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
        aria-label="Interactive subway map. Pinch or scroll to zoom, use arrow keys to move, or press zero to reset."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
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
          aria-label={
            visibleRouteIds
              ? "Animated scheduled trains for the focused subway routes"
              : "Animated scheduled subway trains moving across a generalized map of New York City"
          }
        />
      </div>
    </div>
  );
}

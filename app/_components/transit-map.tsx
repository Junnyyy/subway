"use client";

import {
  type RefObject,
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
    water: "#171d23",
    land: "#222a31",
    park: "#24382f",
    parkStroke: "rgba(111, 160, 122, 0.22)",
    ink: "#eef2f4",
    muted: "#a4adb4",
    faint: "#6f7981",
    hairline: "rgba(238, 242, 244, 0.12)",
    street: "rgba(177, 186, 193, 0.37)",
    localStreet: "rgba(152, 163, 172, 0.22)",
    casing: "rgba(20, 26, 31, 0.9)",
    inset: "rgba(34, 42, 49, 0.84)",
  },
} as const;

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
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const trainCanvasRef = useRef<HTMLCanvasElement>(null);
  const size = useCanvasSize(containerRef);
  const clockRef = useRef({ seconds: modelClock.seconds, capturedAt: 0 });
  const statsRef = useRef({ signature: "", reportedAt: 0 });

  useEffect(() => {
    clockRef.current = {
      seconds: modelClock.seconds,
      capturedAt: performance.now(),
    };
  }, [modelClock.seconds, modelClock.serviceDate]);

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
  }, [isPlaying, onStats, routes, scene, size.height, size.width]);

  return (
    <div className={styles.canvasStack} ref={containerRef}>
      <canvas className={styles.mapCanvas} ref={staticCanvasRef} aria-hidden="true" />
      <canvas
        className={styles.trainCanvas}
        ref={trainCanvasRef}
        role="img"
        aria-label="Animated scheduled subway trains moving across a generalized map of New York City"
      />
    </div>
  );
}

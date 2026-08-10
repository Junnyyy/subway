"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  activeServiceIds,
  getNewYorkClock,
  shiftServiceDate,
} from "@/lib/subway/schedule";
import type {
  ScheduleChunk,
  SubwayManifest,
  SubwayMapData,
  ThemeName,
} from "@/lib/subway/types";
import {
  type LoadedScene,
  type ModelClock,
  type SceneStats,
  type ServiceContext,
  TransitMap,
} from "./transit-map";
import styles from "../page.module.css";

type ThemeMode = "system" | ThemeName;

const jsonCache = new Map<string, Promise<unknown>>();

function loadJson<T>(url: string) {
  const cached = jsonCache.get(url);
  if (cached) return cached as Promise<T>;
  const request = fetch(url).then(async (response) => {
    if (!response.ok) throw new Error(`Unable to load ${url} (${response.status})`);
    return (await response.json()) as T;
  });
  jsonCache.set(url, request);
  request.catch(() => jsonCache.delete(url));
  return request;
}

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeToColorScheme(callback: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getColorSchemeSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot() {
  return false;
}

function formatClock(seconds: number) {
  const normalized = ((Math.floor(seconds) % 86_400) + 86_400) % 86_400;
  const hours = Math.floor(normalized / 3600);
  const minutes = Math.floor((normalized % 3600) / 60);
  const remainingSeconds = normalized % 60;
  return {
    time: `${hours % 12 || 12}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`,
    suffix: hours >= 12 ? "PM" : "AM",
  };
}

function formatServiceDate(serviceDate: string) {
  const date = new Date(
    `${serviceDate.slice(0, 4)}-${serviceDate.slice(4, 6)}-${serviceDate.slice(6, 8)}T12:00:00Z`,
  );
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resolveModelClock(now: number, manifest: SubwayManifest): ModelClock {
  const date = new Date(now);
  const clock = getNewYorkClock(date);
  const isCovered =
    clock.serviceDate >= manifest.feed.startDate &&
    clock.serviceDate <= manifest.feed.endDate;
  return {
    serviceDate: isCovered ? clock.serviceDate : manifest.feed.endDate,
    seconds: clock.seconds + date.getMilliseconds() / 1_000,
    replay: !isCovered,
  };
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

export function TransitExperience({ manifest }: { manifest: SubwayManifest }) {
  const [now, setNow] = useState(0);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [scene, setScene] = useState<LoadedScene | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<SceneStats>({ total: 0, byRoute: {} });
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerSnapshot,
  );
  const systemIsDark = useSyncExternalStore(
    subscribeToColorScheme,
    getColorSchemeSnapshot,
    getServerSnapshot,
  );
  const isDark = theme === "dark" || (theme === "system" && systemIsDark);
  const themeAttribute = theme === "system" ? "system" : theme;
  const isPlaying = !prefersReducedMotion;
  const modelClock = useMemo(
    () =>
      now
        ? resolveModelClock(now, manifest)
        : {
            serviceDate: "",
            seconds: 0,
            replay: false,
          },
    [manifest, now],
  );
  const displayedClock = now
    ? formatClock(modelClock.seconds)
    : { time: "—:—:—", suffix: "" };

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const firstTick = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1_000);
    return () => {
      window.clearTimeout(firstTick);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!modelClock.serviceDate) return;
    let ignore = false;
    const previousDate = shiftServiceDate(modelClock.serviceDate, -1);
    const currentServices = activeServiceIds(
      manifest.calendars,
      manifest.exceptions,
      modelClock.serviceDate,
    );
    const previousServices = activeServiceIds(
      manifest.calendars,
      manifest.exceptions,
      previousDate,
    );
    const contexts: ServiceContext[] = [
      ...currentServices.map((serviceId) => ({
        serviceId,
        dayOffset: 0 as const,
      })),
      ...previousServices.map((serviceId) => ({
        serviceId,
        dayOffset: 1 as const,
      })),
    ].filter((context) => manifest.schedules[context.serviceId]);
    const serviceIds = [...new Set(contexts.map((context) => context.serviceId))];

    Promise.all([
      loadJson<SubwayMapData>(manifest.mapFile),
      Promise.all(
        serviceIds.map(
          async (serviceId) =>
            [
              serviceId,
              await loadJson<ScheduleChunk>(manifest.schedules[serviceId]),
            ] as const,
        ),
      ),
    ])
      .then(([map, schedules]) => {
        if (ignore) return;
        setScene({ map, schedules: new Map(schedules), contexts });
        setLoadError(null);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setLoadError(
          error instanceof Error ? error.message : "Unable to load subway data",
        );
      });

    return () => {
      ignore = true;
    };
  }, [manifest, modelClock.serviceDate]);

  const toggleTheme = () => {
    if (theme === "system") {
      setTheme(systemIsDark ? "light" : "dark");
      return;
    }
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleStats = useCallback((nextStats: SceneStats) => {
    setStats(nextStats);
  }, []);

  return (
    <main className={styles.experience} data-theme={themeAttribute}>
      <aside className={styles.rail}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>New York City</p>
          <h1>Subway in motion</h1>
          <p>A city I love, moving through the system that connects it.</p>
        </div>

        <div className={styles.timeBlock}>
          <div className={styles.statusLine}>
            <span className={styles.statusDot} aria-hidden="true" />
            <span>{modelClock.replay ? "Schedule replay" : "Scheduled now"}</span>
          </div>
          <div className={styles.timeValue} suppressHydrationWarning>
            <strong>{displayedClock.time}</strong>
            <span>{displayedClock.suffix} ET</span>
          </div>
          <small>
            {modelClock.serviceDate
              ? formatServiceDate(modelClock.serviceDate)
              : "New York time"}
          </small>
        </div>

        <div className={styles.legend} aria-label="Subway route color legend">
          {manifest.routeFamilies.map((family) => {
            const count = family.routeIds.reduce(
              (total, routeId) => total + (stats.byRoute[routeId] ?? 0),
              0,
            );
            return (
              <div className={styles.legendRow} key={family.color}>
                <span
                  className={styles.legendMark}
                  style={{ backgroundColor: family.color }}
                  aria-hidden="true"
                />
                <span>{family.labels.join(" ")}</span>
                <small>{count}</small>
              </div>
            );
          })}
        </div>

        <dl className={styles.stats}>
          <div>
            <dt>Landmarks</dt>
            <dd>{scene?.map.landmarks.length ?? 19}</dd>
          </div>
          <div>
            <dt>Scheduled trains</dt>
            <dd>{stats.total}</dd>
          </div>
          <div>
            <dt>Position model</dt>
            <dd>{isPlaying ? "Following now" : "Minute snapshots"}</dd>
          </div>
        </dl>

        <div className={styles.controls}>
          <button
            className={styles.iconButton}
            type="button"
            aria-label={isDark ? "Use light appearance" : "Use dark appearance"}
            onClick={toggleTheme}
          >
            <ThemeIcon dark={isDark} />
          </button>
        </div>

        <p className={styles.disclosure}>
          Modeled from MTA static GTFS. Scheduled positions are not live train
          locations. Original cartography; not an official MTA map.
        </p>
      </aside>

      <section
        className={styles.mapPanel}
        aria-label="Scheduled New York City subway map"
      >
        <div className={styles.mapTopline}>
          <span>Transit overlay</span>
          <span title={`GTFS ${manifest.feed.version}`}>
            {loadError ?? "MTA static GTFS · modeled positions"}
          </span>
        </div>
        <TransitMap
          scene={scene}
          routes={manifest.routes}
          dark={isDark}
          isPlaying={isPlaying}
          modelClock={modelClock}
          onStats={handleStats}
        />
        {!scene && !loadError ? (
          <div className={styles.loading} role="status">
            Preparing today&apos;s schedule
          </div>
        ) : null}
        <p className={styles.srOnly} aria-live="polite">
          {stats.total} trains represented from the current MTA schedule.
        </p>
      </section>
    </main>
  );
}

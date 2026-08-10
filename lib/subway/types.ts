export type ThemeName = "light" | "dark";

export type FeedInfo = {
  publisherName: string;
  publisherUrl: string;
  startDate: string;
  endDate: string;
  version: string;
};

export type ServiceCalendar = {
  id: string;
  weekdays: readonly number[];
  startDate: string;
  endDate: string;
};

export type ServiceException = {
  serviceId: string;
  date: string;
  added: boolean;
};

export type RouteDefinition = {
  id: string;
  label: string;
  name: string;
  color: string;
  textColor: string;
  sortOrder: number;
};

export type ShapeDefinition = {
  id: string;
  routeId: string;
  points: number[];
  distances: number[];
};

export type TripKeyframe = readonly [
  arrivalSeconds: number,
  departureSeconds: number,
  distance: number,
];

export type ScheduledTrip = {
  id: string;
  routeId: string;
  shapeIndex: number;
  direction: number;
  startSeconds: number;
  endSeconds: number;
  keyframes: TripKeyframe[];
};

export type ScheduleChunk = {
  serviceId: string;
  trips: ScheduledTrip[];
};

export type MapLabel = {
  id: string;
  label: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  anchor: "start" | "end" | "middle";
};

export type SubwayMapData = {
  viewBox: readonly [number, number];
  boroughs: Array<{
    id: string;
    name: string;
    path: string;
    label: { x: number; y: number };
  }>;
  statenIsland: { path: string };
  parks: string;
  streets: {
    arterial: string;
    manhattan: string;
    statenIsland: string;
  };
  shapes: ShapeDefinition[];
  landmarks: MapLabel[];
};

export type SubwayManifest = {
  schemaVersion: 1;
  feed: FeedInfo;
  mapFile: string;
  routes: RouteDefinition[];
  calendars: ServiceCalendar[];
  exceptions: ServiceException[];
  schedules: Record<string, string>;
  sourceHashes: Record<string, string>;
};

export type ScheduledPosition = {
  x: number;
  y: number;
  distance: number;
  progress: number;
};

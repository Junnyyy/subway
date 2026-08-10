import type {
  ScheduledPosition,
  ScheduledTrip,
  ServiceCalendar,
  ServiceException,
  ShapeDefinition,
} from "./types";

const NEW_YORK_TIME_ZONE = "America/New_York";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: NEW_YORK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: NEW_YORK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function partsByType(formatter: Intl.DateTimeFormat, date: Date) {
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function parseGtfsTime(value: string) {
  const match = /^(\d{1,2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid GTFS time: ${value}`);
  const [, hours, minutes, seconds] = match;
  const minute = Number(minutes);
  const second = Number(seconds);
  if (minute > 59 || second > 59) {
    throw new Error(`Invalid GTFS time: ${value}`);
  }
  return Number(hours) * 3600 + minute * 60 + second;
}

export function compactServiceDate(value: string) {
  return value.replaceAll("-", "");
}

export function dashedServiceDate(value: string) {
  if (!/^\d{8}$/.test(value)) throw new Error(`Invalid service date: ${value}`);
  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
}

export function shiftServiceDate(value: string, days: number) {
  const dashed = dashedServiceDate(compactServiceDate(value));
  const date = new Date(`${dashed}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

export function getNewYorkClock(date = new Date()) {
  const parts = partsByType(dateTimeFormatter, date);
  return {
    serviceDate: `${parts.year}${parts.month}${parts.day}`,
    seconds:
      Number(parts.hour) * 3600 +
      Number(parts.minute) * 60 +
      Number(parts.second),
  };
}

export function formatNewYorkServiceDate(date = new Date()) {
  const parts = partsByType(dateFormatter, date);
  return `${parts.year}${parts.month}${parts.day}`;
}

function weekdayIndex(serviceDate: string) {
  const dashed = dashedServiceDate(serviceDate);
  return new Date(`${dashed}T12:00:00Z`).getUTCDay();
}

export function activeServiceIds(
  calendars: readonly ServiceCalendar[],
  exceptions: readonly ServiceException[],
  serviceDate: string,
) {
  const weekday = weekdayIndex(serviceDate);
  const active = new Set(
    calendars
      .filter(
        (calendar) =>
          calendar.startDate <= serviceDate &&
          calendar.endDate >= serviceDate &&
          calendar.weekdays.includes(weekday),
      )
      .map((calendar) => calendar.id),
  );

  for (const exception of exceptions) {
    if (exception.date !== serviceDate) continue;
    if (exception.added) active.add(exception.serviceId);
    else active.delete(exception.serviceId);
  }

  return [...active].sort();
}

function smoothProgress(value: number) {
  const clamped = Math.min(1, Math.max(0, value));
  return clamped * clamped * (3 - 2 * clamped);
}

export function positionAtDistance(
  shape: ShapeDefinition,
  distance: number,
): ScheduledPosition | null {
  if (shape.distances.length < 2 || shape.points.length < 4) return null;
  const maximum = shape.distances.at(-1) ?? 0;
  const target = Math.min(maximum, Math.max(0, distance));

  let low = 1;
  let high = shape.distances.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (shape.distances[middle] < target) low = middle + 1;
    else high = middle;
  }

  const endIndex = low;
  const startIndex = Math.max(0, endIndex - 1);
  const startDistance = shape.distances[startIndex];
  const endDistance = shape.distances[endIndex];
  const segmentLength = endDistance - startDistance;
  const progress = segmentLength > 0 ? (target - startDistance) / segmentLength : 0;
  const startPointIndex = startIndex * 2;
  const endPointIndex = endIndex * 2;

  return {
    x:
      shape.points[startPointIndex] +
      (shape.points[endPointIndex] - shape.points[startPointIndex]) * progress,
    y:
      shape.points[startPointIndex + 1] +
      (shape.points[endPointIndex + 1] - shape.points[startPointIndex + 1]) *
        progress,
    distance: target,
    progress: maximum > 0 ? target / maximum : 0,
  };
}

export function shapePointsBetweenDistances(
  shape: ShapeDefinition,
  startDistance: number,
  endDistance: number,
) {
  const start = positionAtDistance(shape, startDistance);
  const end = positionAtDistance(shape, endDistance);
  if (!start || !end) return [];
  if (start.distance === end.distance) return [{ x: start.x, y: start.y }];

  const forward = start.distance < end.distance;
  const lowerDistance = Math.min(start.distance, end.distance);
  const upperDistance = Math.max(start.distance, end.distance);
  const points = [{ x: start.x, y: start.y }];

  for (let index = 0; index < shape.distances.length; index += 1) {
    const distance = shape.distances[index];
    if (distance <= lowerDistance || distance >= upperDistance) continue;
    points.push({ x: shape.points[index * 2], y: shape.points[index * 2 + 1] });
  }

  points.push({ x: end.x, y: end.y });
  return forward ? points : points.reverse();
}

export function sampleScheduledTrip(
  trip: ScheduledTrip,
  shape: ShapeDefinition,
  seconds: number,
) {
  if (seconds < trip.startSeconds || seconds > trip.endSeconds) return null;
  const frames = trip.keyframes;
  if (!frames.length) return null;
  if (frames.length === 1) return positionAtDistance(shape, frames[0][2]);

  let low = 0;
  let high = frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (frames[middle][0] <= seconds) low = middle;
    else high = middle - 1;
  }

  const current = frames[low];
  if (seconds <= current[1] || low === frames.length - 1) {
    return positionAtDistance(shape, current[2]);
  }

  const next = frames[low + 1];
  if (seconds >= next[0]) return positionAtDistance(shape, next[2]);
  const duration = next[0] - current[1];
  const progress = duration > 0 ? (seconds - current[1]) / duration : 1;
  const eased = smoothProgress(progress);
  return positionAtDistance(
    shape,
    current[2] + (next[2] - current[2]) * eased,
  );
}

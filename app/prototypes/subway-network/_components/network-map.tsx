"use client";

import type { RefObject } from "react";
import {
  boroughs,
  diagramStations,
  geographicStations,
  keyPlaceLabels,
  routeFamilies,
} from "./network-data";
import styles from "./subway-prototype.module.css";

type MapMode = "geographic" | "diagram" | "flow";

type NetworkMapProps = {
  mode: MapMode;
  svgRef: RefObject<SVGSVGElement | null>;
  className?: string;
};

const trainDensity: Record<MapMode, number> = {
  geographic: 3,
  diagram: 2,
  flow: 2,
};

export function NetworkMap({ mode, svgRef, className = "" }: NetworkMapProps) {
  const diagram = mode === "diagram";
  const flow = mode === "flow";
  const stations = diagram ? diagramStations : geographicStations;
  const viewBox = flow ? "370 70 750 650" : "0 0 1200 760";
  const visibleRoutes = flow
    ? routeFamilies.filter((route) => route.id !== "sir")
    : routeFamilies;

  return (
    <svg
      ref={svgRef}
      className={`${styles.networkMap} ${styles[`${mode}Map`]} ${className}`}
      viewBox={viewBox}
      role="img"
      aria-labelledby={`${mode}-map-title ${mode}-map-description`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id={`${mode}-map-title`}>New York City subway in motion</title>
      <desc id={`${mode}-map-description`}>
        A stylized map of the five boroughs with route-colored subway trains
        moving along representative paths. This prototype uses simulated
        schedule positions rather than live train data.
      </desc>

      <g className={styles.boroughLayer} aria-hidden="true">
        {boroughs.map((borough) => (
          <path
            key={borough.id}
            className={styles.boroughShape}
            d={borough.path}
          />
        ))}
      </g>

      {!diagram ? (
        <g className={styles.boroughLabelLayer} aria-hidden="true">
          {boroughs.map((borough) => (
            <text
              key={borough.id}
              x={borough.label.x}
              y={borough.label.y}
              textAnchor="middle"
            >
              {borough.name}
            </text>
          ))}
        </g>
      ) : null}

      <g className={styles.routeCasingLayer} aria-hidden="true">
        {visibleRoutes.map((route) => (
          <path
            key={route.id}
            d={diagram ? route.diagramPath : route.geographicPath}
          />
        ))}
      </g>

      <g className={styles.routeLayer} aria-hidden="true">
        {visibleRoutes.map((route) => (
          <path
            key={route.id}
            d={diagram ? route.diagramPath : route.geographicPath}
            stroke={route.color}
          />
        ))}
      </g>

      {!flow ? (
        <g className={styles.stationLayer} aria-hidden="true">
          {stations.map((station) => (
            <circle
              key={station.id}
              className={station.interchange ? styles.interchange : undefined}
              cx={station.x}
              cy={station.y}
              r={station.interchange ? 5.5 : 3.25}
            />
          ))}
        </g>
      ) : null}

      {mode === "geographic" ? (
        <g className={styles.placeLabelLayer} aria-hidden="true">
          {keyPlaceLabels.map((place) => (
            <text
              key={place.text}
              x={place.x}
              y={place.y}
              textAnchor={place.anchor}
            >
              {place.text}
            </text>
          ))}
        </g>
      ) : null}

      <g className={styles.trainLayer} aria-hidden="true">
        {visibleRoutes.flatMap((route, routeIndex) =>
          Array.from({ length: trainDensity[mode] }, (_, trainIndex) => {
            const service = route.services[trainIndex % route.services.length];
            const reverse = trainIndex % 2 === 1;
            const duration = route.duration + (flow ? -5 : trainIndex * 2);
            const offset = (routeIndex * 3.7 + trainIndex * 8.3) % duration;
            const path = diagram ? route.diagramPath : route.geographicPath;

            return (
              <g
                key={`${route.id}-${trainIndex}`}
                className={`${styles.train} ${flow ? styles.flowTrain : ""}`}
              >
                <circle r={flow ? 12.5 : 10.5} fill={route.color} />
                <text
                  className={
                    route.foreground === "dark"
                      ? styles.darkTrainLabel
                      : undefined
                  }
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {service}
                </text>
                <animateMotion
                  path={path}
                  dur={`${duration}s`}
                  begin={`-${offset}s`}
                  repeatCount="indefinite"
                  rotate="0"
                  keyPoints={reverse ? "1;0" : "0;1"}
                  keyTimes="0;1"
                  calcMode="linear"
                />
              </g>
            );
          }),
        )}
      </g>
    </svg>
  );
}

export function RouteLegend({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`${styles.routeLegend} ${compact ? styles.compactLegend : ""}`}
      aria-label="Subway route color legend"
    >
      {routeFamilies
        .filter((route) => route.id !== "sir")
        .map((route) => (
          <div className={styles.legendFamily} key={route.id}>
            <span
              className={styles.legendMark}
              style={{ backgroundColor: route.color }}
              aria-hidden="true"
            />
            <span>{route.services.join(" ")}</span>
          </div>
        ))}
    </div>
  );
}


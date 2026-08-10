"use client";

import type { RefObject } from "react";
import { cityMapData } from "./city-map-data";
import styles from "./subway-prototype.module.css";

export type MapDensity = "atlas" | "overlay" | "quiet";

type CityMapProps = {
  density: MapDensity;
  svgRef: RefObject<SVGSVGElement | null>;
  className?: string;
};

const trainLimit: Record<MapDensity, number> = {
  atlas: 1,
  overlay: 4,
  quiet: 1,
};

export function CityMap({ density, svgRef, className = "" }: CityMapProps) {
  const showSecondaryStreets = density === "atlas";
  const showManhattanGrid = density !== "quiet";
  const showAllStations = density === "atlas";
  const showParkLabels = density === "atlas";
  const showPlaceLabels = density === "atlas";

  return (
    <svg
      ref={svgRef}
      className={`${styles.cityMap} ${styles[`${density}Map`]} ${className}`}
      viewBox={cityMapData.viewBox}
      role="img"
      aria-labelledby={`${density}-map-title ${density}-map-description`}
      preserveAspectRatio="xMidYMid meet"
    >
      <title id={`${density}-map-title`}>New York City subway movement study</title>
      <desc id={`${density}-map-description`}>
        A generalized map built from New York City borough, street, and park
        geometry with MTA static schedule route shapes. Train positions are
        simulated for this visual prototype.
      </desc>

      <g className={styles.landLayer} fillRule="evenodd" aria-hidden="true">
        {cityMapData.boroughs.map((borough) => (
          <path key={borough.id} d={borough.path} />
        ))}
      </g>

      <path
        className={styles.parkLayer}
        d={cityMapData.parks}
        fillRule="evenodd"
        aria-hidden="true"
      />

      <g className={styles.streetLayer} aria-hidden="true">
        {showManhattanGrid ? (
          <path className={styles.manhattanGrid} d={cityMapData.streets.manhattan} />
        ) : null}
        {showSecondaryStreets ? (
          <path className={styles.secondaryStreets} d={cityMapData.streets.secondary} />
        ) : null}
        <path className={styles.arterialStreets} d={cityMapData.streets.arterial} />
      </g>

      <g className={styles.boroughLabelLayer} aria-hidden="true">
        {cityMapData.boroughs.map((borough) => (
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

      {showPlaceLabels ? (
        <g className={styles.placeLabelLayer} aria-hidden="true">
          {cityMapData.places.map((place) => (
            <text key={place.name} x={place.x} y={place.y} textAnchor="middle">
              {place.name}
            </text>
          ))}
        </g>
      ) : null}

      {showParkLabels ? (
        <g className={styles.parkLabelLayer} aria-hidden="true">
          {cityMapData.parkLabels.map((park) => (
            <text key={park.name} x={park.x} y={park.y} textAnchor="middle">
              {park.name.replace("Flushing Meadows Corona Park", "Flushing Meadows")}
            </text>
          ))}
        </g>
      ) : null}

      <g className={styles.routeCasingLayer} aria-hidden="true">
        {cityMapData.routeFamilies.map((family) => (
          <path key={family.id} d={family.networkPath} />
        ))}
      </g>
      <g className={styles.routeLayer} aria-hidden="true">
        {cityMapData.routeFamilies.map((family) => (
          <path key={family.id} d={family.networkPath} stroke={family.color} />
        ))}
      </g>

      <g className={styles.stationLayer} aria-hidden="true">
        {(showAllStations ? cityMapData.stations : cityMapData.hubs).map((station) => (
          <circle
            key={"id" in station ? station.id : `${station.name}-${station.x}-${station.y}`}
            cx={station.x}
            cy={station.y}
            r={showAllStations ? 1.35 : 3.4}
          />
        ))}
      </g>

      {density !== "quiet" ? (
        <g className={styles.hubLabelLayer} aria-hidden="true">
          {cityMapData.hubs.map((hub) => (
            <text key={hub.name} x={hub.x + 7} y={hub.y - 7}>
              {hub.name
                .replace("-Parsons/Archer", "")
                .replace("-Barclays Ctr", "")}
            </text>
          ))}
        </g>
      ) : null}

      <g className={styles.insetLayer} aria-hidden="true">
        <rect x="20" y="606" width="252" height="184" rx="12" />
        <path className={styles.insetLand} d={cityMapData.statenIsland.path} />
        {density === "atlas" ? (
          <path className={styles.insetStreets} d={cityMapData.streets.statenIsland} />
        ) : null}
        <path className={styles.insetRouteCasing} d={cityMapData.sir.path} />
        <path
          className={styles.insetRoute}
          d={cityMapData.sir.path}
          stroke={cityMapData.sir.color}
        />
        <text className={styles.insetTitle} x="33" y="628">
          Staten Island
        </text>
        <text className={styles.insetNote} x="33" y="646">
          geographic inset
        </text>
      </g>

      <g className={styles.trainLayer} aria-hidden="true">
        {cityMapData.routeFamilies.flatMap((family, familyIndex) =>
          family.services
            .slice(0, trainLimit[density])
            .map((service, serviceIndex) => {
              const offset =
                (familyIndex * 4.1 + serviceIndex * 6.7) % service.duration;
              const reverse = (familyIndex + serviceIndex) % 2 === 1;
              return (
                <g key={`${family.id}-${service.id}`} className={styles.train}>
                  <circle r={density === "overlay" ? 8.8 : 8} fill={family.color} />
                  <text
                    fill={family.textColor}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {service.label}
                  </text>
                  <animateMotion
                    path={service.path}
                    dur={`${service.duration}s`}
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

        <g className={styles.train}>
          <circle r="7.5" fill={cityMapData.sir.color} />
          <text
            fill={cityMapData.sir.textColor}
            textAnchor="middle"
            dominantBaseline="central"
          >
            S
          </text>
          <animateMotion
            path={cityMapData.sir.path}
            dur={`${cityMapData.sir.duration}s`}
            begin="-8s"
            repeatCount="indefinite"
            rotate="0"
            calcMode="linear"
          />
        </g>
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
      {cityMapData.routeFamilies.map((family) => (
        <div className={styles.legendFamily} key={family.id}>
          <span
            className={styles.legendMark}
            style={{ backgroundColor: family.color }}
            aria-hidden="true"
          />
          <span>{family.services.map((service) => service.label).join(" ")}</span>
        </div>
      ))}
    </div>
  );
}

export { cityMapData };

"use client";

import { useRef } from "react";
import { CityMap, RouteLegend, cityMapData } from "./city-map";
import { MapControls } from "./map-controls";
import styles from "./subway-prototype.module.css";
import { useMapControls } from "./use-map-controls";

export function TransitOverlayVariant() {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useMapControls(svgRef);
  const trainCount =
    cityMapData.routeFamilies.reduce(
      (total, family) => total + family.services.length,
      0,
    ) + 1;

  return (
    <main
      className={`${styles.experience} ${styles.overlayExperience}`}
      data-theme={controls.theme}
    >
      <aside className={styles.overlayRail}>
        <div className={styles.overlayIntro}>
          <p className={styles.eyebrow}>New York City</p>
          <h1>Subway in motion</h1>
          <p>
            Real city geometry, quiet streets, and the network kept at the
            center of gravity.
          </p>
        </div>

        <div className={styles.timeBlock}>
          <span>Model time</span>
          <strong>08:42</strong>
          <small>Weekday schedule loop</small>
        </div>

        <RouteLegend />

        <dl className={styles.overlayStats}>
          <div>
            <dt>Stations</dt>
            <dd>{cityMapData.stations.length}</dd>
          </div>
          <div>
            <dt>Trains in motion</dt>
            <dd>{trainCount}</dd>
          </div>
          <div>
            <dt>Position model</dt>
            <dd>{controls.isPlaying ? "Running" : "Paused"}</dd>
          </div>
        </dl>

        <MapControls
          className={styles.overlayControls}
          isPlaying={controls.isPlaying}
          isDark={controls.isDark}
          prefersReducedMotion={controls.prefersReducedMotion}
          onTogglePlayback={controls.togglePlayback}
          onToggleTheme={controls.toggleTheme}
        />
      </aside>

      <section className={styles.overlayCanvas} aria-label="Transit overlay map">
        <div className={styles.mapTopline}>
          <span>Transit overlay</span>
          <span>Static GTFS · simulated positions</span>
        </div>
        <CityMap density="overlay" svgRef={svgRef} />
      </section>
    </main>
  );
}

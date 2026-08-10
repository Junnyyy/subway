"use client";

import { useRef } from "react";
import { CityMap, RouteLegend } from "./city-map";
import { MapControls } from "./map-controls";
import styles from "./subway-prototype.module.css";
import { useMapControls } from "./use-map-controls";

export function StreetAtlasVariant() {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useMapControls(svgRef);

  return (
    <main
      className={`${styles.experience} ${styles.atlasExperience}`}
      data-theme={controls.theme}
    >
      <header className={styles.atlasHeader}>
        <div>
          <p className={styles.eyebrow}>New York City · schedule study</p>
          <h1>Street atlas</h1>
        </div>
        <div className={styles.atlasClock} aria-label="Model time 8:42 AM">
          <span>08:42</span>
          <small>AM</small>
        </div>
        <MapControls
          isPlaying={controls.isPlaying}
          isDark={controls.isDark}
          prefersReducedMotion={controls.prefersReducedMotion}
          onTogglePlayback={controls.togglePlayback}
          onToggleTheme={controls.toggleTheme}
        />
      </header>

      <section className={styles.atlasCanvas} aria-label="Detailed city map">
        <CityMap density="atlas" svgRef={svgRef} />
      </section>

      <footer className={styles.atlasFooter}>
        <RouteLegend compact />
        <p>City detail foregrounded · trains simulated from static GTFS paths</p>
      </footer>
    </main>
  );
}

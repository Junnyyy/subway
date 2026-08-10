"use client";

import { useRef } from "react";
import { MapControls } from "./map-controls";
import { NetworkMap, RouteLegend } from "./network-map";
import styles from "./subway-prototype.module.css";
import { useMapControls } from "./use-map-controls";

export function BoroughsVariant() {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useMapControls(svgRef);

  return (
    <main
      className={`${styles.experience} ${styles.boroughsExperience}`}
      data-theme={controls.theme}
    >
      <header className={styles.boroughsHeader}>
        <div>
          <p className={styles.eyebrow}>New York City</p>
          <h1>Subway in motion</h1>
        </div>
        <div className={styles.headerMeta}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>Weekday schedule study</span>
        </div>
        <MapControls
          isPlaying={controls.isPlaying}
          isDark={controls.isDark}
          prefersReducedMotion={controls.prefersReducedMotion}
          onTogglePlayback={controls.togglePlayback}
          onToggleTheme={controls.toggleTheme}
        />
      </header>

      <section className={styles.boroughsCanvas} aria-label="Subway map">
        <NetworkMap
          mode="geographic"
          svgRef={svgRef}
          className={styles.boroughsMap}
        />
      </section>

      <footer className={styles.boroughsFooter}>
        <RouteLegend compact />
        <div className={styles.scheduleStamp}>
          <span>08:42</span>
          <span>Simulated service</span>
        </div>
      </footer>
    </main>
  );
}

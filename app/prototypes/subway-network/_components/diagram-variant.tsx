"use client";

import { useRef } from "react";
import { MapControls } from "./map-controls";
import { NetworkMap, RouteLegend } from "./network-map";
import styles from "./subway-prototype.module.css";
import { useMapControls } from "./use-map-controls";

export function DiagramVariant() {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useMapControls(svgRef);

  return (
    <main
      className={`${styles.experience} ${styles.diagramExperience}`}
      data-theme={controls.theme}
    >
      <aside className={styles.diagramRail}>
        <div className={styles.diagramIntro}>
          <p className={styles.eyebrow}>Network study</p>
          <h1>Weekday service</h1>
          <p>
            A diagrammatic view of the city, tuned for reading the network at a
            glance.
          </p>
        </div>

        <RouteLegend />

        <dl className={styles.diagramStats}>
          <div>
            <dt>Stations</dt>
            <dd>472</dd>
          </div>
          <div>
            <dt>Service groups</dt>
            <dd>9</dd>
          </div>
          <div>
            <dt>Model time</dt>
            <dd>08:42</dd>
          </div>
        </dl>

        <MapControls
          className={styles.diagramControls}
          isPlaying={controls.isPlaying}
          isDark={controls.isDark}
          prefersReducedMotion={controls.prefersReducedMotion}
          onTogglePlayback={controls.togglePlayback}
          onToggleTheme={controls.toggleTheme}
        />
      </aside>

      <section className={styles.diagramCanvas} aria-label="Subway diagram">
        <div className={styles.diagramTopline}>
          <span>All routes</span>
          <span>Simulated positions</span>
        </div>
        <NetworkMap mode="diagram" svgRef={svgRef} />
        <div className={styles.diagramBoroughLabels} aria-hidden="true">
          <span>Bronx</span>
          <span>Manhattan</span>
          <span>Queens</span>
          <span>Brooklyn</span>
        </div>
      </section>
    </main>
  );
}


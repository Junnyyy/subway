"use client";

import { useRef } from "react";
import { MapControls } from "./map-controls";
import { NetworkMap } from "./network-map";
import { routeFamilies } from "./network-data";
import styles from "./subway-prototype.module.css";
import { useMapControls } from "./use-map-controls";

export function FlowVariant() {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useMapControls(svgRef);

  return (
    <main
      className={`${styles.experience} ${styles.flowExperience}`}
      data-theme={controls.theme}
    >
      <header className={styles.flowHeader}>
        <div>
          <p className={styles.eyebrow}>New York · 08:42</p>
          <h1>Moving through the city</h1>
        </div>
        <div className={styles.flowStatus}>
          <span>Schedule loop</span>
          <span aria-hidden="true">/</span>
          <span>{controls.isPlaying ? "Playing" : "Paused"}</span>
        </div>
        <MapControls
          isPlaying={controls.isPlaying}
          isDark={controls.isDark}
          prefersReducedMotion={controls.prefersReducedMotion}
          onTogglePlayback={controls.togglePlayback}
          onToggleTheme={controls.toggleTheme}
        />
      </header>

      <section className={styles.flowCanvas} aria-label="Subway movement view">
        <NetworkMap mode="flow" svgRef={svgRef} />
      </section>

      <footer className={styles.flowFooter}>
        <div className={styles.flowMetric}>
          <span className={styles.flowMetricValue}>42</span>
          <span>trains in view</span>
        </div>
        <div className={styles.flowRouteMarks} aria-label="Visible route groups">
          {routeFamilies
            .filter((route) => route.id !== "sir")
            .map((route) => (
              <span key={route.id}>
                <i
                  style={{ backgroundColor: route.color }}
                  aria-hidden="true"
                />
                {route.services[0]}
              </span>
            ))}
        </div>
        <p>Representative movement · static weekday schedule</p>
      </footer>
    </main>
  );
}


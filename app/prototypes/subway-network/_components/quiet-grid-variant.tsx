"use client";

import { useRef } from "react";
import { CityMap, cityMapData } from "./city-map";
import { MapControls } from "./map-controls";
import styles from "./subway-prototype.module.css";
import { useMapControls } from "./use-map-controls";

export function QuietGridVariant() {
  const svgRef = useRef<SVGSVGElement>(null);
  const controls = useMapControls(svgRef);

  return (
    <main
      className={`${styles.experience} ${styles.quietExperience}`}
      data-theme={controls.theme}
    >
      <header className={styles.quietHeader}>
        <div>
          <p className={styles.eyebrow}>NYC · 08:42</p>
          <h1>Moving through New York</h1>
        </div>
        <MapControls
          isPlaying={controls.isPlaying}
          isDark={controls.isDark}
          prefersReducedMotion={controls.prefersReducedMotion}
          onTogglePlayback={controls.togglePlayback}
          onToggleTheme={controls.toggleTheme}
        />
      </header>

      <section className={styles.quietCanvas} aria-label="Minimal city grid map">
        <CityMap density="quiet" svgRef={svgRef} />
      </section>

      <footer className={styles.quietFooter}>
        <div>
          <strong>{cityMapData.routeFamilies.length}</strong>
          <span>route families</span>
        </div>
        <p>Major streets · parks · subway movement</p>
        <span>{controls.isPlaying ? "In motion" : "Paused"}</span>
      </footer>
    </main>
  );
}

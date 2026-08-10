"use client";

import styles from "./subway-prototype.module.css";

type MapControlsProps = {
  isPlaying: boolean;
  isDark: boolean;
  prefersReducedMotion: boolean;
  onTogglePlayback: () => void;
  onToggleTheme: () => void;
  className?: string;
};

function PauseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="M6.75 5.25v9.5M13.25 5.25v9.5" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <path d="m7 5 7 5-7 5V5Z" />
    </svg>
  );
}

function ThemeIcon({ isDark }: { isDark: boolean }) {
  if (isDark) {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20">
        <path d="M15.3 12.8A6 6 0 0 1 7.2 4.7 6 6 0 1 0 15.3 12.8Z" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 20 20">
      <circle cx="10" cy="10" r="3" />
      <path d="M10 2.2v1.6M10 16.2v1.6M2.2 10h1.6M16.2 10h1.6M4.5 4.5l1.1 1.1M14.4 14.4l1.1 1.1M15.5 4.5l-1.1 1.1M5.6 14.4l-1.1 1.1" />
    </svg>
  );
}

export function MapControls({
  isPlaying,
  isDark,
  prefersReducedMotion,
  onTogglePlayback,
  onToggleTheme,
  className = "",
}: MapControlsProps) {
  return (
    <div className={`${styles.mapControls} ${className}`}>
      <button
        className={styles.iconButton}
        type="button"
        aria-label={isPlaying ? "Pause trains" : "Play trains"}
        aria-pressed={!isPlaying}
        onClick={onTogglePlayback}
      >
        {isPlaying ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        className={styles.iconButton}
        type="button"
        aria-label={isDark ? "Use light appearance" : "Use dark appearance"}
        onClick={onToggleTheme}
      >
        <ThemeIcon isDark={isDark} />
      </button>
      {prefersReducedMotion && !isPlaying ? (
        <span className={styles.reducedMotionNote}>Motion paused</span>
      ) : null}
    </div>
  );
}


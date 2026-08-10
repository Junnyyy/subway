"use client";

import {
  type RefObject,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";

export type ThemeMode = "system" | "light" | "dark";
type PlaybackMode = "auto" | "playing" | "paused";

function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

function subscribeToColorScheme(callback: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getColorSchemeSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getColorSchemeServerSnapshot() {
  return false;
}

export function useMapControls(svgRef: RefObject<SVGSVGElement | null>) {
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [playback, setPlayback] = useState<PlaybackMode>("auto");
  const prefersReducedMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const systemIsDark = useSyncExternalStore(
    subscribeToColorScheme,
    getColorSchemeSnapshot,
    getColorSchemeServerSnapshot,
  );
  const isDark = theme === "dark" || (theme === "system" && systemIsDark);
  const isPlaying =
    playback === "playing" ||
    (playback === "auto" && !prefersReducedMotion);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const syncPlayback = () => {
      if (document.hidden || !isPlaying) svg.pauseAnimations();
      else svg.unpauseAnimations();
    };

    syncPlayback();
    document.addEventListener("visibilitychange", syncPlayback);
    return () => document.removeEventListener("visibilitychange", syncPlayback);
  }, [isPlaying, svgRef]);

  const togglePlayback = () => {
    setPlayback(isPlaying ? "paused" : "playing");
  };

  const toggleTheme = () => {
    if (theme === "system") {
      setTheme(systemIsDark ? "light" : "dark");
      return;
    }
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return {
    theme,
    isDark,
    isPlaying,
    prefersReducedMotion,
    togglePlayback,
    toggleTheme,
  };
}

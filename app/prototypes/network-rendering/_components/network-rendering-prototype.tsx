"use client";

import {
  type ComponentType,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  PrototypeScene,
  StudyVariantProps,
  ViewState,
} from "./rendering-study";
import { ReferenceVariant } from "./reference-variant";
import { SharedLanesVariant } from "./shared-lanes-variant";
import { TrunkBandsVariant } from "./trunk-bands-variant";
import styles from "./network-rendering.module.css";

type ThemeMode = "system" | "light" | "dark";

type Variant = {
  name: string;
  component: ComponentType<StudyVariantProps>;
};

const variants: Variant[] = [
  { name: "Reference", component: ReferenceVariant },
  { name: "Trunk Bands", component: TrunkBandsVariant },
  { name: "Shared Lanes", component: SharedLanesVariant },
];

const initialView: ViewState = { zoom: 1, panX: 0, panY: 0 };

function subscribeToColorScheme(callback: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function getColorSchemeSnapshot() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getServerSnapshot() {
  return false;
}

async function loadJson<T>(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load ${url}`);
  return (await response.json()) as T;
}

export function NetworkRenderingPrototype({
  initialVariant,
}: {
  initialVariant: number;
}) {
  const [activeIndex, setActiveIndex] = useState(initialVariant);
  const [scene, setScene] = useState<PrototypeScene | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [view, setView] = useState<ViewState>(initialView);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const systemIsDark = useSyncExternalStore(
    subscribeToColorScheme,
    getColorSchemeSnapshot,
    getServerSnapshot,
  );
  const dark = theme === "dark" || (theme === "system" && systemIsDark);

  useEffect(() => {
    let ignore = false;

    loadJson<PrototypeScene["manifest"]>("/data/subway/manifest.json")
      .then(async (manifest) => {
        const [map, detail] = await Promise.all([
          loadJson<PrototypeScene["map"]>(manifest.mapFile),
          loadJson<PrototypeScene["detail"]>(
            "/data/prototypes/network-rendering.json",
          ),
        ]);
        return { manifest, map, detail };
      })
      .then((nextScene) => {
        if (!ignore) setScene(nextScene);
      })
      .catch((error: unknown) => {
        if (ignore) return;
        setLoadError(
          error instanceof Error ? error.message : "Unable to load prototype",
        );
      });

    return () => {
      ignore = true;
    };
  }, []);

  const moveHighlight = useCallback(() => {
    const item = itemRefs.current[activeIndex];
    const highlight = highlightRef.current;
    if (!item || !highlight) return;
    highlight.style.width = `${item.offsetWidth}px`;
    highlight.style.transform = `translateX(${item.offsetLeft}px)`;
  }, [activeIndex]);

  const setActive = useCallback((index: number) => {
    if (index < 0 || index >= variants.length) return;
    setActiveIndex(index);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(index + 1));
    window.history.replaceState(null, "", url);
  }, []);

  useLayoutEffect(() => {
    moveHighlight();
  }, [moveHighlight]);

  useEffect(() => {
    const handleResize = () => moveHighlight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [moveHighlight]);

  useEffect(() => {
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        pickerRef.current?.setAttribute("data-ready", "");
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const number = Number.parseInt(event.key, 10);
      if (number >= 1 && number <= variants.length) {
        setActive(number - 1);
      } else if (event.key === "ArrowRight") {
        setActive((activeIndex + 1) % variants.length);
      } else if (event.key === "ArrowLeft") {
        setActive((activeIndex - 1 + variants.length) % variants.length);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, setActive]);

  const toggleTheme = () => {
    if (theme === "system") {
      setTheme(systemIsDark ? "light" : "dark");
      return;
    }
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const ActiveVariant = variants[activeIndex].component;

  return (
    <div className={styles.prototypeStage}>
      <ActiveVariant
        key={activeIndex}
        scene={scene}
        loadError={loadError}
        dark={dark}
        view={view}
        setView={setView}
        resetView={() => setView(initialView)}
        toggleTheme={toggleTheme}
      />

      <nav
        ref={pickerRef}
        className="proto-picker"
        aria-label="Prototype variants"
      >
        <span
          ref={highlightRef}
          className="proto-picker-highlight"
          aria-hidden="true"
        />
        {variants.map((variant, index) => {
          const active = index === activeIndex;
          return (
            <button
              key={variant.name}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              className="proto-picker-item"
              data-active={active ? "" : undefined}
              aria-current={active ? "true" : undefined}
              onClick={() => setActive(index)}
            >
              {variant.name}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

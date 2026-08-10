"use client";

import {
  type ComponentType,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { QuietGridVariant } from "./quiet-grid-variant";
import { StreetAtlasVariant } from "./street-atlas-variant";
import { TransitOverlayVariant } from "./transit-overlay-variant";
import styles from "./subway-prototype.module.css";

type Variant = {
  name: string;
  component: ComponentType;
};

const variants: Variant[] = [
  { name: "Street Atlas", component: StreetAtlasVariant },
  { name: "Transit Overlay", component: TransitOverlayVariant },
  { name: "Quiet Grid", component: QuietGridVariant },
];

export function SubwayPrototype({
  initialVariant,
}: {
  initialVariant: number;
}) {
  const [activeIndex, setActiveIndex] = useState(initialVariant);
  const [replayKey, setReplayKey] = useState(0);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

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
    setReplayKey((value) => value + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(index + 1));
    window.history.replaceState(null, "", url);
  }, []);

  const replay = useCallback(() => {
    setReplayKey((value) => value + 1);
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
      } else if (event.key === "r" || event.key === "R") {
        replay();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, replay, setActive]);

  const ActiveVariant = variants[activeIndex].component;

  return (
    <div className={styles.prototypeStage}>
      <ActiveVariant key={`${activeIndex}-${replayKey}`} />

      <nav ref={pickerRef} className="proto-picker" aria-label="Prototype variants">
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
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={replay}
        >
          ↻
        </button>
      </nav>
    </div>
  );
}

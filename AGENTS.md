<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project learnings

- The visualization exploration is isolated at
  `app/prototypes/subway-network`. It contains three switchable directions
  (Boroughs, Diagram, and Flow); do not import prototype components into the
  production surface before a direction is selected.
- Prototype train positions and route geometry are intentionally synthetic.
  Route colors are derived from the official MTA Colors dataset. When a
  direction is promoted, replace the representative paths with generated
  geometry from the official static subway GTFS `shapes.txt` file before
  adding GTFS-RT.
- MTA data feeds are free to use, but MTA logos, maps, symbols, and related
  intellectual property may require a license. Keep original cartography and
  avoid copying official map assets without resolving that boundary.
- In the restricted Codex environment, the default Turbopack production build
  can fail while binding an internal compiler port. The documented Next.js
  Webpack fallback distinguishes that environment failure from application
  source errors: `pnpm build --webpack`.
- The second subway-network prototype round replaces Boroughs, Diagram, and
  Flow with Street Atlas, Transit Overlay, and Quiet Grid. All three share the
  same geographic substrate so reviews compare visual density and information
  hierarchy rather than unrelated map shapes.
- The corridor-rendering study is isolated at
  `app/prototypes/network-rendering` and compares Reference, Trunk Bands, and
  Shared Lanes without changing the production map. Keep its picker and
  prototype-only data out of the production component graph until the user
  selects a direction.
- `scripts/prototypes/generate-network-rendering.mjs` writes the study's
  `public/data/prototypes/network-rendering.json` artifact from the same MTA
  GTFS and NYC borough projection as production. It keeps 22,597 points at a
  `0.06` simplification tolerance versus production's 11,890 points at `0.24`.
  Shared Lanes detects nearby parallel color families with a direction-aware
  spatial grid; its computed lane geometry is cached across picker switches.
- `scripts/generate-subway-prototype-data.mjs` produces the prototype-only
  `city-map-data.ts` artifact from official NYC borough, street-centerline, and
  functional-parkland GeoJSON plus the static MTA subway GTFS. It merges road
  geometry into a few SVG paths, keeps Manhattan local streets while limiting
  outer-borough streets to cartographic levels, and selects dominant GTFS
  shapes for each service. Train positions remain deliberately simulated.
- Map landmark callouts are keyed to stable GTFS parent stop IDs rather than
  stop names because major complexes often repeat the same name across several
  route records. Keep the hand-tuned label offsets and anchors in the generator
  when adding hubs so the Transit Overlay remains sparse and collision-free.
- Transit Overlay is the selected implementation direction. Preserve its left
  service rail, restrained station set, and transit-first hierarchy; do not
  expand it into an all-stations map. The landmark set intentionally includes
  the user-specific anchors Columbia University, W 4 St–NYU, and World Trade
  Center alongside the broader city landmarks.
- The production data pipeline lives under `scripts/subway` and writes a small
  manifest plus content-hashed map and per-service schedule chunks to
  `public/data/subway`. MTA stop times do not provide shape distances, so the
  generator projects every trip stop monotonically onto its GTFS shape and
  preserves service times beyond `24:00:00`; do not repeat this work in the
  browser or bundle the raw GTFS tables into React.
- Use the repository's native `pnpm` workflow for development, data generation,
  tests, and builds; do not substitute npm or Corepack commands.
- The production route renders the geographic base and moving trains on two
  canvas layers: static cartography redraws only for resize/theme changes while
  the train layer samples schedule keyframes outside React state. The clock
  always follows `America/New_York`; `prefers-reduced-motion` uses minute-based
  snapshots instead of continuous train motion, without adding playback UI.
- Map inspection uses a single composite transform around both canvas layers:
  1–5× wheel, keyboard, and pinch zoom plus pointer or arrow-key pan.
  Keep gesture updates out of React state. The renderer applies an immediate
  composite transform during input, then predictively commits a scale-aware
  Canvas redraw after 12% zoom-in, 6% zoom-out, or 48 px of pan, with a 90 ms
  settle fallback. This keeps labels and streets sharp near the viewport edges
  without repainting every gesture frame. Use `overflow: clip` and an isolated
  map stacking context; scroll-container clipping can retain an unwanted
  horizontal offset after zoom-button focus.
- Desktop trackpad pinch needs both browser paths: Chromium and Firefox expose
  pinch as a `wheel` event with `ctrlKey`, while desktop Safari also emits
  `gesturestart`, `gesturechange`, and `gestureend`. Register the Safari events
  natively with `passive: false`, clean them up, and retain pointer-based pinch
  for touch devices. Register `wheel` directly on the map surface with
  `passive: false` as well; relying on React's delegated wheel event can let the
  same gesture scroll the document. Prevent propagation only inside the map so
  scrolling over the sidebar and other page surfaces remains native.
- Train direction uses a fixed 15 screen-pixel stem immediately behind each
  moving roundel, with a route-colored outer stroke and thin contrasting core.
  Trace the stem through the local GTFS shape vertices so it remains on curved
  tracks at high zoom, and omit it when the train has not moved during the
  prior 5 seconds. Do not restore time-based wakes or traveling glints: their
  length and animation become visual noise at rush-hour density. Preserve the
  reduced-motion minute snapshots.
- The Canvas animation clock is monotonic between schedule-date or replay-mode
  changes. Do not re-anchor it to the once-per-second React display clock; that
  tiny correction appears as train jitter at 5× zoom. Re-anchor only after a
  date/mode boundary or when a hidden tab becomes visible again.
- Generated artifacts retain the hashed Staten Island geometry and SIR schedule
  for source reproducibility, but the production experience excludes route
  `SI`, its family, trains, tracks, land, and streets at the render boundary.
  Keep the desktop camera centered on the four-borough frame instead of
  reserving visual space for an inset.
- Dark mode intentionally uses near-black water and chrome with subtly lighter
  land, streets, and parks rather than a blue-gray wash. Route lines use a
  restrained constant screen weight as the camera zooms so geography remains
  legible instead of scaling the transit strokes into dominant bands.
- The production rail intentionally echoes johnnyle.io through the native
  system-sans stack, warm `#f7f7f7` / `#111111` panel surfaces, medium-weight
  editorial heading, and readable 11–14 px supporting scale. Keep the map's
  existing water, land, park, and route palette independent so portfolio
  cohesion frames the transit spectacle instead of recoloring it. Desktop uses
  a 296 px rail with a 56 px top rhythm, short viewports retain the compact
  fallback, and mobile uses a three-column 44 px route grid.
- The production map supports inspection through 5× (500%) zoom. Keep the
  appearance control as a bare, action-oriented sun or moon glyph with its full
  44 px hit area. Keep the production rail introduction limited to the “New
  York City” eyebrow and “Subway in motion” title; the former personal sentence
  beneath the title was intentionally removed to keep the desktop rail spare.
- Production share identity uses the blue A-train roundel: the hand-authored
  `app/icon.svg` replaces the default favicon, while `app/opengraph-image.tsx`
  and `app/twitter-image.tsx` render the flat 1200×630 social card.
  `public/brand/subway-in-motion.svg` mirrors that composition for repository
  documentation. The social composition uses the current rail's warm light
  surface, native-sans-like editorial hierarchy, and `New York City` eyebrow.
  Keep all three deterministic and gradient-free, and keep the generated card
  and repository SVG visually synchronized. Metadata URL resolution prefers
  `NEXT_PUBLIC_SITE_URL`, then Vercel production/preview hosts, then localhost.
- `README.md` is the public technical overview of the position model. Keep its
  stop-to-shape projection, monotonic shape distance, smoothstep schedule
  interpolation, previous-day GTFS handling, and content-hashed compiler steps
  synchronized with `scripts/subway` and `lib/subway/schedule.ts`.
- The initial `system` appearance must be represented as `data-theme="system"`
  in server-rendered markup. CSS resolves those tokens through
  `prefers-color-scheme` before hydration; JavaScript still resolves the same
  media query for Canvas colors and the appearance control.
- The bundled MTA static GTFS currently covers 2026-05-26 through 2026-10-31.
  It is sufficient for an immediate 2026-08-10 release, but regular GTFS omits
  most temporary service changes and must be refreshed for later timetables.
  MTA data feeds are free to use; the A-train roundel is a licensed subway route
  indicator, so retain the licensing warning in `README.md` until resolved.
- Production route-family rows are interactive toggle buttons for the nine core
  color families. Fine-pointer hover temporarily previews a family; click,
  keyboard, or touch pins it; activating the pinned family restores the full
  network after hover leaves. Communicate focus only through the active route
  color and monochrome, dimmed alternatives—never a row background. Preserve
  the 40 px desktop and 44 px mobile targets, `aria-pressed`, neutral focus ring,
  capability-gated hover, and reduced-motion press behavior.
- The production canvas intentionally omits the former top-line captions,
  visible zoom HUD, position-model statistic, Staten Island, and SIR.
  Zoom and pan remain available through wheel, pinch, pointer, double-click,
  and keyboard input.
- Map correctness is bounded by its sources: boroughs, streets, and parks are
  simplified projections of the hashed NYC datasets, while route paths and
  scheduled motion come from hashed MTA GTFS shapes, trips, stops, and stop
  times. Tests must keep every route in exactly one matching color family,
  verify shape-distance parity and monotonicity, constrain all points to the
  intended main or Staten Island frame, and preserve unique in-bounds labels.

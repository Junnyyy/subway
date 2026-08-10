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
  source errors: `npm run build -- --webpack`.
- The second subway-network prototype round replaces Boroughs, Diagram, and
  Flow with Street Atlas, Transit Overlay, and Quiet Grid. All three share the
  same geographic substrate so reviews compare visual density and information
  hierarchy rather than unrelated map shapes.
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

# StarryEyes — Schematic Viewer System
## Design Brief for Coding Agent

**Project:** StarryEyes (React web application)
**Feature:** Ship & Subsystem Schematic Viewer
**Stack:** React + TypeScript + Vite

---

## Overview

Build a data-driven schematic viewer for StarryEyes. The system has two distinct concerns that must stay cleanly separated:

1. **Schematic documents** — pure TypeScript data files describing shapes, layers, annotations, and animations. No rendering logic. Think of them like SVG source files, but typed and human-editable.
2. **SchematicViewer** — a React component that consumes schematic documents and renders them as animated SVG. All visual complexity lives here, not in the data files.

The intended workflow is: a developer (or AI coding agent) edits a `.schematic.ts` file, Vite HMR hot-swaps it, and the viewer updates live in the browser without a page reload or any animation interruption.

---

## Goals

- Schematics must be editable by a non-rendering-expert. Coordinates, colors, shapes — that's it.
- The viewer must handle all glow effects, animated conduit flows, and the plasma field renderer automatically based on type tags in the data.
- Layer visibility must be togglable at runtime via UI buttons auto-generated from the layer definitions.
- The system must be extensible: adding a new schematic file should require zero changes to the viewer.
- All animation must run via `requestAnimationFrame`, not CSS transitions, so the tick is available for data-driven effects (oscillating gauges, waveforms, etc.).

---

## File Structure

```
src/
  schematics/
    schematic-schema.ts          # Type definitions only — no logic
    SchematicViewer.tsx          # The renderer — consumes any SchematicDocument
    reactor.schematic.ts         # Example: Fusion Reactor Section A
    ship-overview.schematic.ts   # Example: Full ship top-down overview
  App.tsx                        # Wires a schematic into the viewer
```

---

## Schema Type Definitions (`schematic-schema.ts`)

Define the following TypeScript types. This file must contain **only types** — no runtime code, no imports from React or SVG libraries.

### Primitives

```typescript
type Color = string;              // any CSS color: "#f59e0b", "rgba(...)", "url(#gradId)"
type Vec2  = { x: number; y: number };
```

### Gradients

```typescript
interface GradientStop {
  offset:  number;   // 0–1
  color:   Color;
  opacity: number;   // 0–1
}

interface RadialGradient {
  type:  "radial";
  id:    string;
  cx?:   number;     // 0–1, default 0.5
  cy?:   number;     // 0–1, default 0.5
  r?:    number;     // 0–1, default 0.5
  stops: GradientStop[];
}

interface LinearGradient {
  type: "linear";
  id:   string;
  x1?:  number; y1?: number;
  x2?:  number; y2?: number;
  stops: GradientStop[];
}

type Gradient = RadialGradient | LinearGradient;
```

### Animations

All animations are declared in the data layer as intent. The viewer resolves them to SVG/CSS mechanics.

```typescript
// Animated stroke-dashoffset — the "conduit flow" effect.
// Works on any stroked shape. The viewer generates a unique @keyframes rule per shape.
interface FlowDashAnimation {
  type:       "flowDash";
  dasharray:  string;              // e.g. "10 4" — on-length space-length
  duration:   number;              // seconds per cycle
  direction?: "forward" | "reverse";
}

// Oscillates a numeric SVG attribute between two values using SVG <animate>.
// Use for: opacity, r, strokeWidth, etc.
interface PulseAnimation {
  type:      "pulse";
  attribute: string;               // SVG attribute name
  from:      number;
  to:        number;
  duration:  number;               // seconds
  easing?:   "linear" | "ease-in-out";
}

// Continuous rotation of a shape around its own centre.
interface RotateAnimation {
  type:       "rotate";
  duration:   number;              // seconds per full revolution
  direction?: "cw" | "ccw";
}

// Special case: renders a full animated plasma field (rotating magnetic field
// lines, turbulent bezier paths, pulsing core glow) clipped to the shape's bounds.
// Only meaningful on an ellipse — the ellipse defines the containment region.
interface PlasmaFieldAnimation {
  type:           "plasmaField";
  particleCount?: number;          // turbulence path count, default 6
  rotationSpeed?: number;          // field line rotation, degrees/sec, default 22
  coreColor?:     Color;           // default "#fbbf24"
  outerColor?:    Color;           // default "#f97316"
}

type Animation = FlowDashAnimation | PulseAnimation | RotateAnimation | PlasmaFieldAnimation;
```

### Effects

```typescript
// SVG feGaussianBlur drop-glow. The viewer auto-generates a unique <filter> per shape.
interface GlowEffect {
  type:       "glow";
  blur:       number;              // stdDeviation — typically 1.5–10
  intensity?: number;              // stacked blur passes for wider halos, default 1
}

type Effect = GlowEffect;
```

### Style

```typescript
interface Style {
  stroke?:      Color;
  strokeWidth?: number;
  fill?:        Color | "none";    // can reference gradient id: "url(#myGradient)"
  opacity?:     number;            // 0–1
  effect?:      Effect;
  animation?:   Animation;
}
```

### Shapes

```typescript
interface RectShape    { type: "rect";     x: number; y: number; width: number; height: number; rx?: number; style?: Style; }
interface EllipseShape { type: "ellipse";  cx: number; cy: number; rx: number; ry: number; style?: Style; }
interface CircleShape  { type: "circle";   cx: number; cy: number; r: number; style?: Style; }
interface PathShape    { type: "path";     d: string; style?: Style; }
interface LineShape    { type: "line";     x1: number; y1: number; x2: number; y2: number; style?: Style; }
interface PolylineShape{ type: "polyline"; points: Vec2[]; style?: Style; }

type Shape = RectShape | EllipseShape | CircleShape | PathShape | LineShape | PolylineShape;
```

### Annotations

Annotations are overlaid on top of all shapes. They are not interactive.

```typescript
// Static text label
interface TextAnnotation {
  type:      "text";
  x:         number;
  y:         number;
  content:   string;
  anchor?:   "start" | "middle" | "end";
  size?:     number;
  color?:    Color;
  tracking?: number;              // letter-spacing in px
}

// Line from a point (on a shape) to a label offset from it
interface CalloutAnnotation {
  type:      "callout";
  from:      Vec2;                // tip, touching the shape
  to:        Vec2;                // label position
  label:     string;
  sublabel?: string;              // smaller secondary line
  color?:    Color;
}

// Double-ended dimension line with a measurement label
interface DimensionAnnotation {
  type:    "dimension";
  from:    Vec2;
  to:      Vec2;
  label:   string;
  offset?: number;                // perpendicular offset for the line, default 0
  color?:  Color;
}

type Annotation = TextAnnotation | CalloutAnnotation | DimensionAnnotation;
```

### Layers

```typescript
interface Layer {
  id:          string;
  label:       string;            // displayed on toggle button
  color?:      Color;             // accent color for the toggle button
  defaultOn?:  boolean;           // initial visibility, default false
  toggleable?: boolean;           // show toggle button, default true
  shapes:      Shape[];
  annotations?: Annotation[];
}
```

### Document

```typescript
interface SchematicMeta {
  vessel:          string;        // e.g. "DSV NEMESIS-7"
  system:          string;        // e.g. "FUSION REACTOR — SECTION A"
  subsystem?:      string;
  class?:          string;
  revision?:       string;
  classification?: string;        // rendered as a footer stamp
}

interface SchematicDocument {
  meta:        SchematicMeta;
  viewBox:     { width: number; height: number };
  background?: Color;
  gradients?:  Gradient[];
  layers:      Layer[];           // rendered bottom-to-top
}
```

---

## SchematicViewer Component (`SchematicViewer.tsx`)

`props: { doc: SchematicDocument }`

### Visual Style

The viewer has a fixed Dark Signal / Cold War submarine tactical display aesthetic. This is not configurable per-document — it is the viewer's identity.

- Background: `#040c14` (near-black blue)
- Grid: subtle 16px repeating SVG pattern, `#09182255`
- Font: `Share Tech Mono` (Google Fonts) for all labels, annotations, toggles, header
- Color palette: amber (power), cyan (field/coolant), green (life support), violet (data), orange (plasma)
- All interactive elements (toggle buttons) use a glowing border style that reflects the layer's color when active

### Header

Rendered above the SVG. Pulls from `doc.meta`:
```
[vessel]  [system]  [subsystem]  REV [revision]  ◉ ONLINE (blinking)
```
All fields optional except `vessel` and `system`. The `◉ ONLINE` indicator blinks via a CSS `step-end` keyframe animation.

### SVG Rendering

The SVG uses `viewBox="0 0 {width} {height}"` and `width="100%" maxWidth=900`. It must scale responsively.

Render order within the SVG:
1. Background rect (solid color)
2. Background grid pattern
3. Gradient `<defs>` from `doc.gradients`
4. Auto-generated glow filter `<defs>` (one per shape with a `GlowEffect`)
5. Auto-generated `@keyframes` CSS (one per shape with a `FlowDashAnimation`, injected into a `<style>` block)
6. Layers in order (bottom to top), skipping any with `visible[layer.id] === false`
7. Classification stamp (from `meta.classification`), bottom-center

### Glow Filter Generation

For each shape with `style.effect.type === "glow"`:
- Generate a unique filter ID (e.g. `gf1`, `gf2`, incrementing)
- Build an SVG `<filter>` with `feGaussianBlur` repeated `intensity` times, merged with `feMerge` so the original sits on top of its blurred copies
- Apply via `filter="url(#gfN)"` on the rendered SVG element

### FlowDash Animation Generation

For each shape with `style.animation.type === "flowDash"`:
- Generate a unique keyframe name tied to that shape
- Emit: `@keyframes name { from { stroke-dashoffset: TOTAL } to { stroke-dashoffset: 0 } }` where `TOTAL = dashOn + dashOff`
- Apply `stroke-dasharray` and `animation: name duration linear infinite` (reversed if `direction === "reverse"`) as inline styles on the SVG element

Use a stable `WeakMap<Shape, string>` ref (via `useRef`) to ensure filter and keyframe IDs are consistent across re-renders and don't regenerate on every tick.

### Pulse Animation

Rendered as an SVG `<animate>` child element on the shape:
```xml
<animate attributeName="..." values="from;to;from" dur="Xs" repeatCount="indefinite"/>
```

### PlasmaField Animation

This is a special renderer, not a generic shape. When a shape has `animation.type === "plasmaField"`, skip normal shape rendering and instead render a `<PlasmaField>` component with the shape's bounding ellipse as its region.

The PlasmaField renderer (driven by the RAF tick, not CSS):

1. **Outer glow** — a large semi-transparent ellipse with a radial gradient, opacity oscillating via `Math.sin(tick * 1.9)`
2. **Rotating field lines** — 6 thin ellipses at varying rotations, grouped and rotated via SVG `transform="rotate(...)"` where the angle is `tick * rotationSpeed`, clipped to the vessel boundary
3. **Turbulence paths** — `particleCount` quadratic bezier curves whose control points drift with `Math.sin(tick + phaseOffset)`. These simulate magnetic flux instability.
4. **Core** — a bright radial gradient ellipse at the centre, radius oscillating slightly with `Math.sin(tick * 2.2)`
5. **Hot spot** — a small near-white ellipse at dead centre, opacity flickering with `Math.sin(tick * 3.1)`

All plasma elements are clipped to the bounding ellipse using a `<clipPath>`.

### Annotation Rendering

**TextAnnotation** → SVG `<text>` with Share Tech Mono, 7px default.

**CalloutAnnotation** → a line from `from` to `to`, then a label at `to`. The label anchor (`start` or `end`) is inferred from whether `to.x < from.x`. Sublabel renders 11px below the label in a dimmer color.

**DimensionAnnotation** → detect horizontal vs vertical from which delta is larger. For horizontal: draw the line, tick marks at each end, centered label below. For vertical: same but rotated 90°. Always render at the `from`/`to` positions directly (no offset arithmetic needed in the data).

### Layer Toggle UI

Below the SVG, render toggle buttons for all layers where `toggleable !== false`.

Button style per layer:
- Inactive: dim border (`#0e2535`), dim text (`#1a4557`), no background
- Active: border = `layer.color`, text = `layer.color`, faint color background (`${layer.color}12`), box-shadow glow (`${layer.color}35`)
- Label: `◉ LABEL` when on, `◎ LABEL` when off

A small `OVERLAY:` label precedes the button row.

### Animation Loop

```typescript
const [tick, setTick] = useState(0);
const rafRef = useRef<number>();
const startRef = useRef(Date.now());

useEffect(() => {
  const loop = () => {
    setTick((Date.now() - startRef.current) / 1000);
    rafRef.current = requestAnimationFrame(loop);
  };
  rafRef.current = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(rafRef.current!);
}, []);
```

Pass `tick` to the `PlasmaField` component. Everything else (flow dashes, pulses) runs via CSS/SVG declarative animation and doesn't need the tick.

---

## Example Schematics to Implement

### `reactor.schematic.ts` — Compact Tokamak Mk-IV

**Layers (bottom to top):**

| Layer ID   | Label        | Color     | Default | Content |
|------------|--------------|-----------|---------|---------|
| `structure`| STRUCTURE    | —         | on, not toggleable | Outer vacuum vessel ellipse (w=260, h=184, centre 390,230), inner wall ellipse, centreline dashed |
| `coils`    | FIELD COILS  | `#38bdf8` | on  | 7 toroidal coil ellipses at dx = -100,-70,-40,0,40,70,100 from centre. Each coil ry follows the vessel profile: `ry = 84 * sqrt(1 - (|dx|/130)^2 * 0.7)`. Each has a GlowEffect blur=2.5 and a pulse animation on opacity (0.4→0.85, 2.1s). Top and bottom coil bus bars as dashed lines. |
| `plasma`   | PLASMA       | `#f97316` | on  | Single ellipse cx=390 cy=230 rx=126 ry=88 with plasmaField animation |
| `coolant`  | COOLANT      | `#4ade80` | off | Two path shapes: coolant feed in (green, forward flow), coolant return (cyan, reverse flow) |
| `power`    | POWER GRID   | `#f59e0b` | on  | Two power feed paths entering from left, one output line exiting right — all fast flowDash |
| `data`     | DATA BUS     | `#c084fc` | off | Two diagnostic lines entering from right — fine rapid flowDash |

**Gradients:**
- `vesselFill`: radial, dark blue-black, for the vessel interior fill
- `plasmaCore`: radial, white core → amber → orange → transparent

**Annotations:**
- Callout from vessel wall → "VACUUM VESSEL / W-ALLOY SHELL"
- Callout from coil array top → "TOROIDAL FIELD COILS / 14.3 MA · 5.3 T"
- Callout from plasma → "PLASMA TORUS / ~1.8×10⁸ K"
- Dimension across vessel width → "6.2m MAJOR DIAMETER"
- Coolant port labels

---

### `ship-overview.schematic.ts` — DSV Nemesis-7 Top-Down

This is a top-down silhouette view of the full ship. The hull is elongated, bow to the right, stern to the left, with engine pods above and below at the stern.

**Hull shape:** An SVG path approximating the hull silhouette. Points (approximate, refine as needed):
```
M 855,250 L 740,178 L 645,168 L 145,168 L 75,205 L 55,250
L 75,295 L 145,332 L 645,332 L 740,322 Z
```
viewBox: 900×500.

**Engine pods:** Two `<path>` shapes — upper pod `M 175,174 L 152,132 L 98,125 L 80,146 L 80,174`, lower pod mirrored below centreline.

**Compartments** (rect shapes inside the hull, `structure` layer):

| ID       | Label      | Sub-label    | x   | y   | w   | h   |
|----------|------------|--------------|-----|-----|-----|-----|
| reactor  | REACTOR    | CORE         | 78  | 207 | 65  | 86  |
| eng      | ENG        | DRIVE SYS    | 151 | 174 | 116 | 152 |
| ops      | OPS        | COMMS        | 273 | 174 | 126 | 73  |
| lifesup  | LIFE SUPP  | ATMO         | 273 | 253 | 126 | 73  |
| crew     | CREW       | BERTHING     | 406 | 174 | 131 | 152 |
| torpedo  | TORPEDO    | FWD BAY      | 543 | 174 | 113 | 72  |
| sensors  | SENSORS    | PASSIVE ARR  | 543 | 254 | 113 | 72  |
| bridge   | BRIDGE     | CIC          | 663 | 174 | 113 | 152 |

Compartments have a double-rect style (outer wall + 4px inset). Corner tick marks (7px L-brackets at each corner, thin lines) are drawn for each compartment — these are four `path` shapes per compartment or a dedicated annotation type.

**Bulkheads:** Dashed vertical `line` shapes at x = 148, 270, 403, 540, 660, 780. Each runs from the interpolated hull top y to hull bottom y at that x position (pre-compute these values, don't express them as formulas in the data).

**Layers (ship overview):**

| Layer ID | Label        | Color     | Default | Conduit routing |
|----------|--------------|-----------|---------|-----------------|
| `power`  | POWER GRID   | `#f59e0b` | on  | Central spine from stern to bridge; vertical branches to each compartment |
| `life`   | LIFE SUPPORT | `#4ade80` | off | Lower bus through all habitable spaces |
| `coolant`| COOLANT      | `#38bdf8` | off | Two parallel lines (feed/return) full length, branching to engine pods |
| `data`   | DATA BUS     | `#c084fc` | off | Data backbone with spurs to each compartment |

**Annotations:**
- Ship designation text `DSV-NM7` near bow
- Dimension line for overall length "87.4m — OVERALL LENGTH"
- Small compass rose (circle + crosshairs) bottom right, with FWD/AFT labels
- Classification stamp at bottom

---

## App Integration (`App.tsx`)

```typescript
import { SchematicViewer } from './schematics/SchematicViewer';
import { reactorSchematic } from './schematics/reactor.schematic';
import { shipSchematic } from './schematics/ship-overview.schematic';

// Simple tab switcher, or just render one for now:
export default function App() {
  return <SchematicViewer doc={reactorSchematic} />;
}
```

---

## Vite Setup Notes

Standard Vite React-TS scaffold:
```bash
npm create vite@latest starryeyes-schematics -- --template react-ts
npm install
npm run dev
```

No additional dependencies needed. Do not use any SVG rendering library — all SVG is hand-generated JSX. Do not use any animation library — RAF and CSS keyframes only.

---

## What This System Is Not

- **Not a general-purpose SVG editor.** There is no drag-to-move, no click-to-select.
- **Not a game engine integration** (that's a separate step — export to JSON for UE5 consumption).
- **Not a diagramming tool** with auto-layout. All coordinates are explicit.

The purpose is a fast, HMR-friendly edit loop where a developer or AI agent can modify schematic `.ts` files and see the result immediately in a browser with full animation running.

---

## Deliverables

1. `src/schematics/schematic-schema.ts` — complete type definitions
2. `src/schematics/SchematicViewer.tsx` — complete renderer component
3. `src/schematics/reactor.schematic.ts` — reactor document using the schema
4. `src/schematics/ship-overview.schematic.ts` — ship overview document
5. `src/App.tsx` — wired up with a simple document selector (two buttons: SHIP OVERVIEW / REACTOR)
6. `index.html` / `vite.config.ts` — standard Vite scaffold, no modifications needed

---

*Grimfox Games — Dark Signal / StarryEyes*

# StarryEyes Client — Codebase Summary

> Expanse-inspired 2D space trading game prototype. Phase 1: Newtonian flight in a Keplerian star system.

## Tech Stack

- **Rendering:** PixiJS 8 (GPU-accelerated 2D)
- **UI:** React 19 + Zustand 5 (state management)
- **Language:** TypeScript (strict mode)
- **Build:** Vite 7, ESLint 9

## Architecture

The codebase follows a **bridge pattern** that cleanly separates simulation from rendering:

```
simulation/   — Pure TypeScript, zero browser deps (Node.js-compatible)
client/       — PixiJS rendering + React HUD + input handling
bridge.ts     — ISimulationBridge interface decouples the two layers
main.tsx      — Bootstrap + game loop
```

Phase 1 uses `LocalBridge` (in-process). Phase 2 will swap in `WebSocketBridge` for multiplayer.

---

## Project Structure

```
starry-eyes-client/src/
├── main.tsx                      # App bootstrap & game loop
├── bridge.ts                     # ISimulationBridge interface + LocalBridge
├── simulation/
│   ├── types.ts                  # Vec2, OrbitalElements, ShipState, SystemSnapshot, commands
│   ├── constants.ts              # Physics constants, body definitions, rendering config
│   ├── system.ts                 # StarSystem — tick, snapshots, body positions
│   ├── kepler.ts                 # Kepler equation solver, orbital math
│   ├── nav.ts                    # Bézier route computation, brachistochrone math
│   ├── soi.ts                    # Sphere of influence calculations
│   ├── commands.ts               # Command processor (destination, pause, time warp)
│   └── physics.ts                # Velocity Verlet integrator (currently unused)
├── client/
│   ├── renderer.ts               # Main PixiJS GameRenderer
│   ├── camera.ts                 # Logarithmic zoom, pan, sim↔screen coords (Y-flipped)
│   ├── bodies.ts                 # Body circles, orbit ellipses, labels
│   ├── trails.ts                 # Ship trail ring buffer recorder
│   ├── input.ts                  # Mouse & keyboard event handling
│   ├── targeting/                # Animated targeting reticle system
│   │   ├── TargetDisplay.ts      # State machine: idle → acquiring → settled → dismissing
│   │   ├── Reticle.ts            # Four L-bracket corners with glow
│   │   ├── ConnectorLine.ts      # 90° elbow connector line
│   │   ├── InfoBox.ts            # Target info panel with [More →]
│   │   ├── infoContent.ts        # Content formatter (body/station/ship info)
│   │   ├── positioning.ts        # Quadrant-adaptive placement logic
│   │   └── easing.ts             # Animation easing functions
│   └── hud/                      # React-based HUD overlay
│       ├── store.ts              # Zustand store (snapshot, panels, popups, modals)
│       ├── HudOverlay.tsx         # Root HUD: time, ship status, fuel bar
│       ├── hud.css               # HUD layout styles
│       ├── theme.css             # CSS variables (sci-fi cyan/blue/orange palette)
│       ├── left-panel/           # Collapsible sidebar with tabs
│       │   ├── LeftPanel.tsx     # Panel container, toggle, breadcrumbs
│       │   ├── TabBar.tsx        # SYS / CREW / OPS / DOCK tabs
│       │   ├── TabContent.tsx    # Routes active tab to content component
│       │   ├── tabConfig.ts      # Tab & sub-tab definitions
│       │   ├── StatusDot.tsx     # Colored status indicator
│       │   ├── sys/SysOverview.tsx    # 9 subsystems with status
│       │   ├── crew/CrewRoster.tsx    # Crew list with skills
│       │   ├── ops/OpsOverview.tsx    # Operations summary
│       │   └── dock/DockOverview.tsx  # Docking services
│       ├── modals/               # Full-screen detail views
│       │   ├── DetailModal.tsx   # Backdrop + escape handling
│       │   ├── ModalContent.tsx  # Routes by object type
│       │   ├── PlanetDetail.tsx  # Planet detail stub
│       │   └── StationDetail.tsx # Station detail stub
│       └── popups/               # Floating info popups (structure in place)
│           ├── InfoPopup.tsx
│           ├── PopupContent.tsx
│           ├── PlanetInfo.tsx
│           ├── ShipInfo.tsx
│           └── StationInfo.tsx
```

---

## Simulation Layer

### Types (`types.ts`)

- **Vec2** — Pure-function vector math (not a class): `vec2Add`, `vec2Sub`, `vec2Scale`, `vec2Length`, `vec2Normalize`, `vec2Rotate`, `vec2Dist`, etc.
- **OrbitalElements** — Semi-major axis, eccentricity, argument of periapsis, mean anomaly at epoch, direction
- **CelestialBody** — Star, planet, moon, or asteroid with mass, radius, color, orbital elements, parent ID
- **ShipState** — Position, velocity, fuel, mode (`idle` | `drift` | `transit` | `orbit`), optional route
- **Route** — Quadratic Bézier curve (P0→P1→P2) with arc length table, acceleration profile, target body
- **SystemSnapshot** — Serializable frame: game time, time compression, body snapshots, ship snapshots
- **PlayerCommand** — `SET_DESTINATION`, `CANCEL_ROUTE`, `SET_TIME_COMPRESSION`, `PAUSE`, `RESUME`

### Kepler Solver (`kepler.ts`)

High-risk math module. Handles both elliptical and hyperbolic orbits.

- `solveKepler(M, e)` — Newton-Raphson for Kepler's equation (E − e·sin E = M)
- `solveKeplerHyperbolic(M, e)` — Hyperbolic variant (e·sinh H − H = M)
- `keplerPositionAtTime(el, t)` / `keplerStateAtTime(el, t)` — Position and velocity from elements
- `stateToElements(pos, vel, mu, t)` — Cartesian state → orbital elements
- `computeOrbitalEllipse(el, numPoints)` — Generate orbit path for rendering

### Navigation (`nav.ts`)

Brachistochrone + Bézier routing for the nav computer.

- `brachistochroneTime(dist, accel)` — Time estimate: 2√(dist/accel)
- `computeRoute(ship, destination, gameTime, bodies, bodyPositionFn)` — Iterative route solver (10 iterations): computes intercept point, control point, arc length table
- `transitPositionAtTime(route, currentTime)` — Evaluate ship position along route with asymmetric accel/decel profile
- `sampleRouteAhead(route, currentTime, numPoints)` — Future position samples for prediction line

### Sphere of Influence (`soi.ts`)

- `buildSOITable(bodies)` — Computes SOI radii: `a × (mass/parentMass)^(2/5)`
- `determineSOIParent(...)` — Hysteresis-based parent detection (enter at 1.0×, exit at 1.05×)

### System (`system.ts`)

The `StarSystem` class drives the simulation.

- **Bodies:** Sol (star), Tellus, Mara, Jove (planets), Europa, Ganymede (moons), 15 seeded asteroids
- **Tick logic** (per ship by mode):
  - `transit` — Follow Bézier route; on arrival, enter orbit or idle
  - `orbit` — Rotate around body at visual speed
  - `drift` — Coast with current velocity
  - `idle` — Stationary
- **Snapshots** — Serializable system state each frame
- **Prediction** — Sample route ahead for trajectory display

### Commands (`commands.ts`)

- `SET_DESTINATION` — Compute route, check fuel, enter transit
- `CANCEL_ROUTE` — Carry momentum into drift, or stop
- Time compression and pause/resume

---

## Client Layer

### Game Loop (`main.tsx`)

Each frame:
1. Compute delta time (clamped to 0.1s)
2. Apply time compression
3. Tick simulation
4. Record trail sample (every `TRAIL_SAMPLE_INTERVAL` game-seconds)
5. Update trajectory prediction (every 5 frames)
6. Track focus target
7. Render (bodies, ships, prediction, trail)
8. Update targeting display animations
9. Push snapshot to Zustand store

### Camera (`camera.ts`)

- Logarithmic zoom: `scale = 1.05^zoomLevel`
- Range: 1e-10 (full system ~2 AU) to 1e-3 (close zoom)
- Y-axis flipped for screen coordinates
- Focus tracking on bodies (cleared by pan)

### Renderer (`renderer.ts`)

PixiJS rendering with layered containers:

1. **World container** (camera-transformed): orbits, bodies, ships, prediction line, trail
2. **UI container** (screen space): targeting display
3. **React overlay** (DOM): HUD

Ship drawn as a chevron with thrust flame (orange, opposite heading) when in transit.

### Bodies (`bodies.ts`)

- Body circles with type-appropriate alpha (star 1.0, planets 0.9, asteroids 0.6)
- Star glow effect (2× radius, 0.15 alpha)
- Orbit ellipses (128 points, alpha varies by type)
- Labels in Consolas 10px cyan (hidden for asteroids)
- Moons fade/hide when <20–40px from parent on screen

### Input (`input.ts`)

| Input | Action |
|---|---|
| Left-click body | Show targeting display |
| Right-click body/space | Set destination |
| Double-click body | Focus camera |
| Mouse wheel | Zoom toward cursor |
| Click-drag | Pan camera |
| Tab | Toggle left panel |
| Escape | Dismiss modal → target → panel → cancel route |
| Space | Pause / resume |
| +/− | Cycle time compression |

### Targeting System (`targeting/`)

Animated target acquisition with four phases:

1. **Acquiring** (0–450ms): Reticle snaps in (easeOutBack) → connector line draws → info box fades in
2. **Settled**: Gentle pulse, content refreshes every 1s
3. **Dismissing** (0–250ms): Staggered fade-out (box → line → reticle)

Components: L-bracket reticle with glow, 90° elbow connector line, info box with [More →] button. Quadrant-adaptive positioning with smooth transitions.

### HUD System (`hud/`)

React overlay powered by Zustand store.

**HudOverlay** displays:
- Top-left: Game time, warp factor, pause indicator
- Top-right: Ship mode, velocity, destination, ETA, deceleration alert
- Bottom-left: Fuel bar with percentage

**Left Panel** — Collapsible sidebar (414px) with four primary tabs:
- **SYS**: Overview, Nav, Drive, Reactor, Thermal, Sensors, Propulsion, Cargo, Comms, Structure
- **CREW**: Roster, Duty, Medical, Morale, Skills
- **OPS**: Overview, Trade, Mining, Scan, Probes, Missions
- **DOCK**: Overview, Market, Refuel, Repair, Crew Hire

Currently implemented: SysOverview, CrewRoster, OpsOverview, DockOverview. Other sub-tabs show placeholder stubs.

**Modals** — Full-screen detail views for planets, stations (stub layouts).

**Theme** — Sci-fi palette: cyan/blue primary, orange accents, dark backgrounds. CSS variables for consistent theming.

---

## Physics Constants

| Constant | Value | Notes |
|---|---|---|
| STAR_MU | 1.327e20 m³/s² | Sun's gravitational parameter |
| SHIP_MAX_ACCELERATION | 9.81 m/s² | ~1g |
| SHIP_FUEL_CAPACITY | 100,000 kg | |
| Time compression steps | 1×, 10×, 100×, 1k×, 5k×, 10k×, 50k×, 100k× | Default: 10,000× |
| Trail buffer | 500 points, sampled every 100 game-seconds | |
| Prediction | 300 steps × 1,000 game-seconds = 300ks lookahead | Updated every 5 frames |

---

## Rendering Order (back to front)

1. Starfield (screen space, currently empty)
2. Orbit ellipses (world space)
3. Body circles + labels (world space)
4. Ship chevron + thrust flame (world space)
5. Prediction dashed line (world space)
6. Trail solid line (world space)
7. Targeting display — reticle, connector, info box (screen space)
8. React HUD overlay (DOM layer)

---

## Z-Index Layers (CSS)

| Layer | z-index |
|---|---|
| HUD panels | 10 |
| Left panel | 20 |
| Popups | 30 |
| Modal backdrop | 40 |
| Modal | 50 |

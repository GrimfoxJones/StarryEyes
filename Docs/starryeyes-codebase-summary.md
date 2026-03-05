# StarryEyes — Codebase Summary

> Expanse-inspired 2D space trading game prototype. Phase 2: pnpm monorepo with authoritative server + client.

## Tech Stack

- **Rendering:** PixiJS 8 (GPU-accelerated 2D)
- **UI:** React 19 + Zustand 5 (state management)
- **Language:** TypeScript (strict mode)
- **Build:** Vite 7, ESLint 9
- **Server:** Express 5, ws (WebSocket), tsx (dev runner)
- **Monorepo:** pnpm workspaces

## Architecture

The codebase is a **pnpm monorepo** with three packages:

```
starry-eyes-shared/   — @starryeyes/shared: types, vec2, kepler, nav, soi, bodies, commands
starry-eyes-server/   — @starryeyes/server: GameServer (20Hz tick), REST + WebSocket
starry-eyes-client/   — PixiJS rendering + React HUD + RemoteBridge for server communication
```

A **bridge pattern** decouples the client from the server:
- `bridge.ts` — `ISimulationBridge` interface (async, push-based snapshots)
- `RemoteBridge.ts` — REST commands + WebSocket snapshots + local Kepler interpolation

The client connects to the authoritative server via REST (commands) and WebSocket (real-time events). Between server updates, the client interpolates positions locally using the same deterministic math from the shared package.

---

## Project Structure

```
starry-eyes-shared/src/
├── index.ts                         # Barrel export
├── types.ts                         # Vec2, OrbitalElements, ShipState, Route, snapshots, commands
├── constants.ts                     # Physics constants, rendering config
├── kepler.ts                        # Kepler equation solver, orbital math
├── nav.ts                           # Bézier route computation, brachistochrone math
├── soi.ts                           # Sphere of influence calculations
├── bodies.ts                        # Body definitions + ship factory
└── commands.ts                      # Command processor (offline mode)

starry-eyes-server/src/
├── index.ts                         # Express + ws bootstrap, graceful shutdown
├── GameServer.ts                    # Authoritative tick loop, ship management, snapshots
├── config.ts                        # PORT, TICK_RATE_MS, DEFAULT_TIME_COMPRESSION
├── session.ts                       # SessionStore (token → player mapping)
├── routes/
│   ├── auth.ts                      # POST /api/auth/join, /api/auth/leave
│   ├── commands.ts                  # POST /api/commands/set-destination, cancel-route, undock
│   ├── state.ts                     # GET /api/state, /api/bodies, /api/ships, /api/sync
│   └── debug.ts                     # POST /api/debug/set-time-compression, pause, resume
└── ws/
    ├── handler.ts                   # WebSocket auth + connection management
    └── events.ts                    # Event type constants

starry-eyes-client/src/
├── main.tsx                         # App bootstrap & game loop
├── bridge.ts                        # ISimulationBridge interface
├── RemoteBridge.ts                  # REST + WS client, local interpolation
├── simulation/
│   └── system.ts                    # StarSystem (kept for potential offline mode)
├── client/
│   ├── renderer.ts                  # Main PixiJS GameRenderer
│   ├── camera.ts                    # Logarithmic zoom, pan, sim↔screen coords (Y-flipped)
│   ├── bodies.ts                    # Body circles, orbit ellipses, labels
│   ├── trails.ts                    # Ship trail ring buffer recorder
│   ├── input.ts                     # Mouse & keyboard event handling
│   ├── targeting/                   # Animated targeting reticle system
│   │   ├── TargetDisplay.ts         # State machine: idle → acquiring → settled → dismissing
│   │   ├── Reticle.ts              # Four L-bracket corners with glow
│   │   ├── ConnectorLine.ts        # 90° elbow connector line
│   │   ├── InfoBox.ts              # Target info panel with [More →]
│   │   ├── infoContent.ts          # Content formatter (body/station/ship info)
│   │   ├── positioning.ts          # Quadrant-adaptive placement logic
│   │   └── easing.ts               # Animation easing functions
│   └── hud/                         # React-based HUD overlay
│       ├── store.ts                 # Zustand store (snapshot, panels, popups, modals)
│       ├── HudOverlay.tsx           # Root HUD: time, ship status, fuel bar
│       ├── hud.css                  # HUD layout styles
│       ├── theme.css                # CSS variables (sci-fi cyan/blue/orange palette)
│       ├── left-panel/              # Collapsible sidebar with tabs
│       │   ├── LeftPanel.tsx        # Panel container, toggle, breadcrumbs
│       │   ├── Breadcrumb.tsx       # Breadcrumb navigation
│       │   ├── TabBar.tsx           # SYS / CREW / OPS / DOCK tabs
│       │   ├── TabContent.tsx       # Routes active tab to content component
│       │   ├── SubTabNav.tsx        # Sub-tab navigation
│       │   ├── StubPlaceholder.tsx  # Placeholder for unimplemented tabs
│       │   ├── tabConfig.ts         # Tab & sub-tab definitions
│       │   ├── StatusDot.tsx        # Colored status indicator
│       │   ├── sys/SysOverview.tsx  # 9 subsystems with status
│       │   ├── crew/CrewRoster.tsx  # Crew list with skills
│       │   ├── ops/OpsOverview.tsx  # Operations summary
│       │   └── dock/DockOverview.tsx # Docking services
│       ├── modals/                  # Full-screen detail views
│       │   ├── DetailModal.tsx      # Backdrop + escape handling
│       │   ├── DetailModal.css      # Modal styles
│       │   ├── ModalContent.tsx     # Routes by object type
│       │   ├── PlanetDetail.tsx     # Planet detail stub
│       │   └── StationDetail.tsx    # Station detail stub
│       └── popups/                  # Floating info popups
│           ├── InfoPopup.tsx
│           ├── InfoPopup.css
│           ├── PopupContent.tsx
│           ├── PlanetInfo.tsx
│           ├── ShipInfo.tsx
│           └── StationInfo.tsx
```

---

## Shared Layer (`@starryeyes/shared`)

### Types (`types.ts`)

- **Vec2** — Pure-function vector math: `vec2Add`, `vec2Sub`, `vec2Scale`, `vec2Length`, `vec2Normalize`, `vec2Rotate`, `vec2Dist`, etc.
- **OrbitalElements** — Semi-major axis, eccentricity, argument of periapsis, mean anomaly at epoch, direction
- **CelestialBody** — Star, planet, moon, asteroid, or station with mass, radius, color, orbital elements, parent ID
- **BodyType** — `'star' | 'planet' | 'moon' | 'asteroid' | 'station'`
- **ShipState** — Position, velocity, fuel, fuelConsumptionRate, mode (`drift` | `transit` | `orbit`), optional route
- **Route** — Quadratic Bézier curve (P0→P1→P2) with arc length table, acceleration profile, target body, `fuelAtRouteStart`, `fuelConsumptionRate`
- **ShipSnapshot** — Serializable ship state including fuel, fuelConsumptionRate, heading, route, mode
- **SystemSnapshot** — Serializable frame: game time, time compression, body snapshots, ship snapshots
- **PlayerCommand** — `SET_DESTINATION`, `CANCEL_ROUTE`, `UNDOCK`

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
- `brachistochroneFuelCost(transitTime, fuelRate)` — Fuel cost for a transit
- `computeRoute(ship, destination, gameTime, bodies, bodyPositionFn)` — Iterative route solver (10 iterations): computes intercept point, control point, arc length table
- `transitPositionAtTime(route, currentTime)` — Evaluate ship position along route with asymmetric accel/decel profile
- `sampleRouteAhead(route, currentTime, numPoints)` — Future position samples for prediction line

### Sphere of Influence (`soi.ts`)

- `buildSOITable(bodies)` — Computes SOI radii: `a × (mass/parentMass)^(2/5)`
- `determineSOIParent(...)` — Hysteresis-based parent detection (enter at 1.0×, exit at 1.05×)

### Bodies (`bodies.ts`)

Body definitions and ship factory.

- **Sol** (star)
- **Tellus** (planet) — with moons **Luna**, **Nyx**, and station **Tycho Station**
- **Mara** (planet)
- **Jove** (planet) — with moons **Europa**, **Ganymede**
- **15 seeded asteroids** in the belt
- `createPlayerShip(bodies, gameTime, shipId)` — Creates a ship in orbit around Tellus

### Commands (`commands.ts`)

Shared command processor used by offline mode (`StarSystem`). Uses `ISystemContext` interface.

- `SET_DESTINATION` — Compute route, check fuel, enrich route with fuel fields, enter transit (no upfront fuel deduction)
- `CANCEL_ROUTE` — Settle fuel at cancellation time, carry momentum into drift
- `UNDOCK` — Leave orbit into drift

---

## Server Layer (`@starryeyes/server`)

### GameServer (`GameServer.ts`)

Authoritative game state running at 20Hz.

- **Ship management:** `addShip()`, `removeShip()`
- **Command processing:** `SET_DESTINATION` (route computation + fuel validation), `CANCEL_ROUTE` (fuel settlement), `UNDOCK`
- **Tick loop** (50ms):
  - Advance game time by `realDt × timeCompression`
  - Update body positions via Kepler
  - Update orbiting ships: advance `orbitAngle`, recompute position around parent body
  - Continuous fuel consumption for transit ships: `fuel = fuelAtRouteStart - rate × elapsed`
  - Detect transit arrivals: enter orbit (if target body) or drift (if point), broadcast `SHIP_ARRIVED`
- **Snapshots:** Full system state or per-ship snapshots with computed heading, ETA, route line

### Server API

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/join` | POST | — | Join game → `{ sessionToken, shipId, gameTime, timeCompression }` |
| `/api/auth/leave` | POST | Bearer | Leave game |
| `/api/state` | GET | — | Full system snapshot |
| `/api/bodies` | GET | — | Body definitions |
| `/api/ships` | GET | — | All ship snapshots |
| `/api/sync` | GET | Bearer | Heartbeat sync (gameTime + player's ship) |
| `/api/commands/set-destination` | POST | Bearer | Set destination (body or point) |
| `/api/commands/cancel-route` | POST | Bearer | Cancel current route |
| `/api/commands/undock` | POST | Bearer | Undock from orbit |
| `/api/debug/set-time-compression` | POST | — | Set time compression |
| `/api/debug/pause` | POST | — | Pause game |
| `/api/debug/resume` | POST | — | Resume game |
| `/ws?token=...` | WS | Query param | Real-time events |

### WebSocket Events

| Event | Direction | Data |
|---|---|---|
| `INITIAL_STATE` | Server → Client | Full `SystemSnapshot` |
| `SHIP_ROUTE_CHANGED` | Server → All | `{ ship: ShipSnapshot }` |
| `SHIP_ARRIVED` | Server → All | `{ ship: ShipSnapshot }` |
| `SHIP_CANCELLED` | Server → All | `{ ship: ShipSnapshot }` |
| `PLAYER_JOINED` | Server → All | `{ playerId, playerName, shipId, ship }` |
| `PLAYER_LEFT` | Server → All | `{ playerId, playerName, shipId }` |

### Session Management (`session.ts`)

- `SessionStore` maps tokens to `{ token, playerId, playerName, shipId, ws }`
- WebSocket connections are bound to sessions via query parameter auth

---

## Client Layer

### RemoteBridge (`RemoteBridge.ts`)

Connects to the server and provides local interpolation between updates.

- **REST commands:** `sendCommand()` dispatches to appropriate endpoint
- **WebSocket:** Receives real-time events, updates ship list
- **Interpolation:** `interpolate()` computes positions between server snapshots:
  - **Transit:** Evaluate Bézier route + interpolate fuel consumption
  - **Orbit:** Advance angle from snapshot position using `ORBIT_VISUAL_SPEED`
  - **Drift:** Linear extrapolation from last known position + velocity
- **Heartbeat sync:** Polls `/api/sync` every 1s to re-anchor game time and ship state

### Game Loop (`main.tsx`)

Each frame:
1. Call `bridge.interpolate()` for latest state
2. Record trail sample
3. Update prediction line (every 5 frames)
4. Track focus target
5. Render (bodies, ships, prediction, trail)
6. Update targeting display animations
7. Push snapshot to Zustand store

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

- Body circles with type-appropriate alpha (star 1.0, planets/moons/stations 0.9, asteroids 0.6)
- Star glow effect (2× radius, 0.15 alpha)
- Orbit ellipses (128 points, alpha varies by type)
- Labels in Consolas 10px cyan (hidden for asteroids)
- Moons and stations fade/hide when <20–40px from parent on screen

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

## Fuel System

Fuel is consumed **continuously** during transit, not deducted upfront.

- Route stores `fuelAtRouteStart` and `fuelConsumptionRate`
- At any time during transit: `fuel = fuelAtRouteStart - rate × elapsed`
- Server tick updates fuel each frame for transit ships
- Client interpolates fuel locally between server updates
- On cancel: fuel is settled at `fuelAtRouteStart - rate × elapsedAtCancel`
- On arrival: fuel is settled at `fuelAtRouteStart - rate × totalTime`

---

## Physics Constants

| Constant | Value | Notes |
|---|---|---|
| STAR_MU | 1.327e20 m³/s² | Sun's gravitational parameter |
| SHIP_MAX_ACCELERATION | 9.81 m/s² | ~1g |
| SHIP_FUEL_CAPACITY | 100,000 kg | |
| SHIP_FUEL_CONSUMPTION_RATE | 0.02 kg/s | At full thrust |
| ORBIT_VISUAL_RADIUS | 5e7 m | 50,000 km visual orbit distance |
| ORBIT_VISUAL_SPEED | 0.05 rad/s | ~2 min per orbit |
| Time compression steps | 1×, 10×, 100×, 1k×, 5k×, 10k×, 50k×, 100k× | Server default: 1,000× |
| Server tick rate | 50ms (20Hz) | |
| Client heartbeat | 1,000ms | Polls `/api/sync` |
| Trail buffer | 500 points, sampled every 100 game-seconds | |
| Prediction | 300 steps × 1,000 game-seconds = 300ks lookahead | Updated every 5 frames |

---

## Rendering Order (back to front)

1. Orbit ellipses (world space)
2. Body circles + labels (world space)
3. Ship chevron + thrust flame (world space)
4. Prediction dashed line (world space)
5. Trail solid line (world space)
6. Targeting display — reticle, connector, info box (screen space)
7. React HUD overlay (DOM layer)

---

## Z-Index Layers (CSS)

| Layer | z-index |
|---|---|
| HUD panels | 10 |
| Left panel | 20 |
| Popups | 30 |
| Modal backdrop | 40 |
| Modal | 50 |

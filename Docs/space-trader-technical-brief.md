# Space Trader — Technical Brief

## Project: StarryEyes (Working Title)

**Version:** 0.1 — Phase 1 Prototype
**Author:** Grimfox Games
**Date:** March 2026

---

## Vision

An io-style MMO space trading game set in a persistent, shared galaxy. Players start as lone traders navigating a realistic-scale star system, buying and selling commodities between stations. The visual language is inspired by The Expanse — information-dense, iconographic, functional displays rather than cinematic 3D. Curved trajectory lines, orbital paths, readouts, and scanner displays *are* the aesthetic.

The game world runs at a fixed 100x time compression — one real second equals 100 game seconds. This is a universal clock shared by all players, not a per-player control. There is no pause, no time skip, no variable warp. Transits between moons take moments; transits between planets take real-time minutes to hours. The persistent, shared timeline is fundamental to the io-MMO design.

Long-term, the game expands into grand strategy territory (empire building, fleet management, territorial control), but that is a future phase. This brief covers only the foundational prototype: a single star system at full realistic scale with Keplerian celestial bodies and a player ship controlled by a nav computer (right-click to set destination, ship flies itself via brachistochrone transit).

---

## Phase 1 Scope

Build a client-side prototype that proves out the core moment-to-moment experience: right-clicking a destination and watching your ship compute and fly a route across a realistic-scale star system.

### What Phase 1 Includes

- A single star system at full realistic scale (~800 million km across) with a central star, several planets, moons, and an asteroid field, all on Keplerian orbits
- A player ship with a nav computer: right-click a destination, the ship computes a brachistochrone route (accelerate first half, flip, decelerate second half) and flies itself there automatically
- Route rendered as a Bézier curve on the map — straight lines from rest, smooth arcs from mid-transit redirects that preserve existing velocity
- A trail line behind the ship showing where it has been
- Fixed 100x time compression (universal game clock — one real second = 100 game seconds, shared by all players, no per-player controls)
- An Expanse-inspired UI overlay: velocity readout, destination, ETA, fuel gauge, game clock
- Zoomable map from full-system view down to local-body proximity
- No economy, no docking, no combat — just flight

### What Phase 1 Does NOT Include

- Per-player time controls (time compression is universal and fixed at 100x)
- Other players or NPCs (but architecture must support them — see below)
- Economy, trade, inventory
- Combat
- Sound (Howler.js integration deferred)
- Docking mechanics

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Rendering | PixiJS | 2D WebGL renderer. All visuals are iconographic/diagrammatic, not 3D. |
| UI Overlay | React | HUD elements, readouts, controls layered over the PixiJS canvas. |
| Audio (future) | Howler.js | Not in Phase 1 but keep the dependency in mind. |
| Language | TypeScript | Strict mode. Strong typing is critical for physics code correctness. |
| Build | Vite | Fast dev iteration. |
| Server (future) | Node.js | REST + WebSocket per system instance. Not in Phase 1 but drives architecture. |

---

## Architecture — Modular for Server Migration

This is the most important architectural constraint. The physics simulation runs client-side in Phase 1 but MUST be structured so it can move to a Node.js server with minimal refactoring. The rendering layer must be fully decoupled from simulation.

### Module Boundaries

```
src/
├── simulation/          # ZERO browser/rendering dependencies
│   ├── types.ts         # Core data types (Vec2, OrbitalElements, ShipState, Route, etc.)
│   ├── constants.ts     # G, time scale, system scale, body masses
│   ├── kepler.ts        # Keplerian orbit math (elements ↔ state vectors, propagation)
│   ├── nav.ts           # Nav computer: intercept computation, Bézier route generation, route evaluation
│   ├── system.ts        # Star system state: bodies, ships, game clock tick
│   └── commands.ts      # Player command interface (set destination, etc.)
│
├── client/              # Browser-only, rendering and input
│   ├── renderer.ts      # PixiJS scene management
│   ├── camera.ts        # Pan, zoom, coordinate transforms
│   ├── trails.ts        # Ship trail and route line rendering
│   ├── bodies.ts        # Celestial body rendering (icons, orbit lines)
│   ├── hud/             # React components for UI overlay
│   └── input.ts         # Mouse/keyboard → commands
│
├── bridge.ts            # Connects simulation to client (in Phase 1: direct calls;
│                        # in Phase 2: WebSocket messages with same interface)
└── main.ts              # Bootstrap
```

### The Bridge Pattern

The bridge module defines the interface between simulation and client. In Phase 1, it's a direct function call. In Phase 2, it becomes a WebSocket message. The simulation and client modules never import each other.

```typescript
// bridge.ts — Phase 1 (local)
interface SimulationBridge {
  // Client → Simulation (commands)
  sendCommand(cmd: PlayerCommand): void;

  // Simulation → Client (state updates)
  onStateUpdate(callback: (state: SystemSnapshot) => void): void;

  // Client queries
  queryPosition(entityId: string, time: number): Vec2;
  queryRoute(shipId: string): Route | null;
}
```

In Phase 2, a `WebSocketBridge` implements the same interface, serializing commands as JSON messages and deserializing state updates. The client and simulation code remain untouched.

### The Simulation Loop

The simulation module exposes a `tick(dt: number)` function. In Phase 1, the client calls this from `requestAnimationFrame` scaled by the fixed 100x time compression. In Phase 2, the server calls it from a `setInterval`. The simulation does not know or care who is calling it.

```typescript
// system.ts
class StarSystem {
  bodies: CelestialBody[];      // Planets, moons, asteroids — Keplerian
  ships: Ship[];                // Player ships — route-based when in transit
  gameTime: number;             // Current game time in seconds

  tick(dt: number): SystemSnapshot {
    this.gameTime += dt;

    // Update Keplerian bodies (analytical — no integration, just evaluate at gameTime)
    for (const body of this.bodies) {
      body.position = keplerPositionAtTime(body.elements, this.gameTime);
    }

    // Update ships based on their current state
    for (const ship of this.ships) {
      switch (ship.state.mode) {
        case 'transit':
          // Position derived from route math (Bézier + acceleration profile)
          ship.position = evaluateRoute(ship.state.route, this.gameTime);
          // Check for arrival
          if (this.gameTime >= ship.state.route.arrivalTime) {
            this.completeTransit(ship);
          }
          break;
        case 'orbit':
          // Ship is logically "at" the body. Position tracks the body.
          ship.position = keplerPositionAtTime(
            this.getBody(ship.state.bodyId).elements, this.gameTime
          );
          break;
        case 'docked':
          // Ship is at the station. Position tracks the station's parent body.
          break;
        case 'idle':
          // Ship is stationary in space. No update needed.
          break;
      }
    }

    return this.snapshot();
  }
}
```

No numerical physics integration is needed for the player ship. Ships in transit derive their position from the nav computer's route math (see Route Curves companion document). Ships in orbit, docked, or idle have trivial position updates.

---

## Physics Model

### Coordinate System

- Origin: system barycenter (central star)
- Units: meters for position, m/s for velocity, m/s² for acceleration
- 2D (top-down orbital plane) — sufficient for a trading game, dramatically simplifies physics and rendering
- At realistic scale (~800 million km system radius), max coordinate value is ~8 × 10^11 meters. 64-bit doubles provide sub-millimeter precision at this range (15+ significant digits). No local frame transforms needed.

### Celestial Bodies — Keplerian

All non-ship bodies (star, planets, moons, asteroids) follow precomputed Keplerian orbits. Their positions are evaluated analytically at any game time T — no simulation, no integration, no error accumulation.

Each body stores:
```typescript
interface CelestialBody {
  id: string;
  name: string;
  mass: number;                 // kg (for gravity calculations)
  radius: number;               // m (for rendering scale and proximity checks)
  elements: OrbitalElements;    // Six Keplerian elements + epoch
  parent: string | null;        // ID of parent body (null for star)
  type: 'star' | 'planet' | 'moon' | 'asteroid';
}
```

Moons orbit planets, planets orbit the star. Render orbital paths as dim ellipses behind the body icons.

### Ships — Nav Computer Route-Based

A ship is always in one of four states: docked, orbit, transit, or idle. During transit, position is derived from the nav computer's route math — not from numerical physics integration. See the Navigation Refactor and Route Curves companion documents for full detail.

```typescript
interface Ship {
  id: string;
  position: Vec2;               // m, system-relative (derived from state)
  maxAcceleration: number;      // m/s² (14.7 for 1.5g trader)
  fuel: number;                 // kg of propellant remaining
  fuelConsumptionRate: number;  // kg/s at full thrust
  state: ShipState;
}

type ShipState =
  | { mode: 'docked'; stationId: string }
  | { mode: 'orbit'; bodyId: string }
  | { mode: 'transit'; route: Route }
  | { mode: 'idle'; position: Vec2; velocity: Vec2 };

interface Route {
  P0: Vec2;                     // Start position
  P1: Vec2;                     // Bézier control point (encodes initial velocity)
  P2: Vec2;                     // Destination (intercept point)
  startTime: number;            // Game time at route start
  transitTime: number;          // Total transit duration (game seconds)
  arrivalTime: number;          // startTime + transitTime
  arcLength: number;            // Total Bézier arc length (meters)
  acceleration: number;         // Ship acceleration for this route
  arcLengthTable: ArcLengthEntry[]; // Pre-computed lookup for distance → Bézier t
}
```

**Transit:** The ship follows a quadratic Bézier curve with a brachistochrone acceleration profile (accelerate first half, flip, decelerate second half). Position at any time is computed analytically from route data — no tick-by-tick integration. See Route Curves doc for the full math.

**Mid-transit redirect:** When the player right-clicks a new destination during transit, the ship's current velocity (direction from Bézier tangent, magnitude from acceleration profile) feeds into the new route's P1 control point, producing a smooth arc. Velocity is NEVER zeroed on redirect. See Bugfix: Preserve Velocity doc.

**Orbit:** The ship is logically "at" a body. The icon orbits visually at a fixed rate. No physics runs.

**Idle:** The ship is stationary in space after arriving at an empty-space destination.

### Gravity

At the thrust levels used in this game (1–3g), gravity during transit is negligible compared to engine acceleration. Ships fly routes computed by the nav computer; gravity is not factored into route math. Keplerian orbital mechanics still govern celestial body motion (planets, moons, asteroids), but the player ship does not experience gravitational forces during transit. This is a deliberate simplification — see the Navigation Refactor doc for rationale.

Future consideration: gravity could matter at very low thrust levels or near massive bodies, but this is not a Phase 1 concern.

### Time Compression

Game time advances at a fixed 100x multiplier of real time. This is a universal game clock — all players share the same game time. There are no per-player pause, speed up, or slow down controls. One real second = 100 game seconds.

```typescript
const TIME_COMPRESSION = 100;  // Fixed. Not configurable per player.
const realDt = (Date.now() - lastRealTime) / 1000;  // seconds
const gameDt = realDt * TIME_COMPRESSION;
system.tick(gameDt);
```

At 100x compression with realistic-scale distances:
- Moon-to-moon transit (~400,000 km at 1.5g): ~3 hours game time → ~1.7 minutes real time
- Inner planet to mid-system (~78 million km at 1.5g): ~40 hours game time → ~24 minutes real time
- Inner planet to outer planet (~630 million km at 1.5g): ~115 hours game time → ~69 minutes real time

Long transits are intentional. Players manage their ship, monitor contacts, and trade during the journey. There is no time skip — this is a persistent shared world.

Show the game clock prominently in the UI. No warp controls are exposed to the player.

### Route Line (Trajectory Visualization)

This is the signature visual feature. When a ship is in transit, render the nav computer's planned route ahead of the ship as a Bézier curve. This is NOT a physics prediction — it's the actual path the ship will follow, computed from the route's control points.

```typescript
function getRoutePoints(route: Route, numPoints: number): Vec2[] {
  const points: Vec2[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push(evaluateBezier(route.P0, route.P1, route.P2, t));
  }
  return points;
}
```

The route line is always accurate — it IS the path. When the player right-clicks a new destination, the new route line appears immediately, showing the smooth Bézier arc from the ship's current position and velocity toward the new intercept point. The old route line fades out as the new one draws. The player's feedback loop is seeing the route curve on the map, the ETA, and the fuel cost — not manually shaping a trajectory.

### Trail Line

Store the ship's recent position history as a polyline rendered behind the ship. Ring buffer of the last N positions sampled at regular game-time intervals. Fade opacity toward the tail. This shows the player where they've been and makes maneuvers visually legible in retrospect.

---

## Rendering (PixiJS)

### Visual Language

The Expanse, not Star Wars. Think CIC tactical displays, not cinematic space vistas.

- **Background:** Very dark (near-black), subtle star field, faint grid lines
- **Star:** Bright point/glow at center, no fancy effects needed
- **Planets:** Small colored circles/icons with labels. Size exaggerated for visibility at zoom-out. Orbital path rendered as a dim ellipse
- **Ship:** Small directional icon (triangle/chevron) with heading indicator. Bright color (cyan/green)
- **Route line:** The nav computer's planned Bézier route rendered as a bright accent-color curve from ship to destination. Straight when departing from rest, smoothly arcing on mid-transit redirects.
- **Trail:** Solid thin line behind ship, fading to transparent over distance. Course change bends are visible in the trail.
- **Drive indicator:** Visual cue on ship icon when engines are firing (glow, particle trail, or simple line extending opposite to heading)
- **UI text:** Monospace or condensed sans-serif. Think military/aerospace labeling

### Camera

- Center of the PixiJS stage is the viewport center
- Mouse wheel zoom (logarithmic scaling)
- Click-drag pan
- Double-click to center on an object
- At maximum zoom-out, entire system visible
- At maximum zoom-in, local detail around a planet or station area

### Coordinate Mapping

Simulation coordinates (meters) must map to screen pixels via the camera transform. This is a simple scale + offset:

```
screenX = (simX - cameraX) * zoom + viewportWidth / 2
screenY = (simY - cameraY) * zoom + viewportHeight / 2
```

Zoom level determines meters-per-pixel. At full zoom-out with ~800 million km system radius: roughly 800,000 km per pixel on a 1000px viewport. The logarithmic zoom range is much larger at realistic scale — zooming from full-system down to local-body proximity spans many orders of magnitude.

---

## Player Input → Commands

All player interaction with the simulation goes through a command interface. Never mutate simulation state directly from input handlers.

```typescript
type PlayerCommand =
  | { type: 'SET_DESTINATION'; shipId: string; target: DestinationTarget }
  | { type: 'CANCEL_ROUTE'; shipId: string }
  | { type: 'UNDOCK'; shipId: string };

type DestinationTarget =
  | { kind: 'body'; bodyId: string }         // Planet or moon — intercept computed
  | { kind: 'station'; stationId: string }    // Station — dock on arrival
  | { kind: 'point'; position: Vec2 };        // Empty space — fly there and stop
```

**Navigation input:** Right-click on the map → identify target (body, station, or empty space) → issue SET_DESTINATION command. The nav computer computes the intercept, generates the Bézier route, and the ship begins transit. No heading or thrust controls are exposed to the player.

Time compression is not a player command — it is a fixed universal constant (100x).

---

## Initial Star System Layout

A handcrafted test system for Phase 1. Not procedurally generated. Full realistic scale — distances are solar-system-like.

| Body | Type | Orbital Radius | Orbital Period (game time) | Mass | Notes |
|------|------|---------------|---------------------------|------|-------|
| Sol | Star | — | — | ~2 × 10^30 kg | Central body. Solar mass produces realistic Keplerian orbits. |
| Tellus | Planet | ~150,000,000 km (1 AU) | ~365 game days | Minor | Inner rocky world. Starting area candidate. Has 1 moon. |
| Mara | Planet | ~230,000,000 km (1.5 AU) | ~687 game days | Minor | Mid-system. Asteroid belt nearby. |
| Jove | Planet | ~780,000,000 km (5.2 AU) | ~12 game years | Moderate | Outer gas giant. Has 2-3 moons. |
| Scattered asteroids | Asteroid field | ~300,000,000–500,000,000 km | Various | Negligible | Visual interest, future mining sites. |

These are full realistic-scale distances. The star's mass should produce orbital periods consistent with Kepler's laws at these radii. At 100x time compression, a Tellus year passes in ~3.65 real-time days.

Transit times at 1.5g (14.7 m/s²) across these distances:
- Tellus to its moon (~400,000 km): ~3 hours game time → ~1.7 min real time
- Tellus to Mara (closest approach ~78M km): ~40 hours game time → ~24 min real time
- Tellus to Jove (closest approach ~630M km): ~115 hours game time → ~69 min real time

---

## Player Ship Defaults

| Property | Value | Notes |
|----------|-------|-------|
| Max acceleration | 14.7 m/s² (~1.5g) | Mid-range trader |
| Fuel capacity | TBD | Enough for several cross-system transits |
| Fuel consumption | TBD | Tuned so fuel is a consideration but not punishing in Phase 1 |
| Starting position | High orbit around Tellus | |
| Starting velocity | Matching Tellus orbital velocity | So the ship begins in a stable orbit |

---

## Key Implementation Notes

1. **TypeScript strict mode.** No `any` types in the simulation module. Physics code must be type-safe.

2. **Pure functions in simulation where possible.** `keplerPositionAtTime(elements, t)` takes inputs, returns outputs, no side effects. Makes testing trivial and server migration clean.

3. **The simulation module must have zero imports from browser APIs.** No `window`, no `document`, no `requestAnimationFrame`, no PixiJS. It must run identically in Node.js.

4. **Frame-rate independent.** The simulation consumes a `dt` parameter. It does not assume any particular frame rate or tick rate.

5. **Route line rendering is cheap** — it's a static Bézier curve that only changes when the player redirects. No per-frame recomputation needed. The arc length table is pre-computed once per route.

6. **Intercept convergence and Bézier control point computation** are the trickiest math in the system. The intercept iteration (finding where a moving planet will be when the ship arrives) and the P1 control point placement (encoding initial velocity into the curve) should be implemented and tested early. See the Route Curves and Navigation Refactor companion documents.

7. **Don't over-optimize Phase 1.** One system, one ship, a handful of bodies. Performance won't be an issue. Focus on correctness and feel.

---

## Success Criteria for Phase 1

The prototype is successful if:

- You can watch planets orbit the star on Keplerian paths under the 100x universal clock
- You can right-click a planet and watch the ship compute and fly a brachistochrone route
- The route line draws as a Bézier curve on the map, showing the full path to the destination
- Mid-transit redirect produces a smooth arcing curve that preserves existing velocity — no velocity discontinuity
- The trail shows your flight history, including the visible bends from course changes
- Zooming in and out feels smooth and the system is legible at multiple scales (realistic distances make this range enormous)
- The whole thing looks and feels like an Expanse tactical display
- The 100x universal game clock runs consistently with no per-player time controls
- The codebase is cleanly separated such that `simulation/` could be dropped into a Node.js project and run without modification

---

## What Comes Next (Not In Scope Now)

For context only — do not build any of this in Phase 1:

- **Phase 2:** Server migration. Move simulation to Node.js, WebSocket bridge, multiple concurrent players in a system.
- **Phase 3:** Economy. Stations, commodities, buy/sell, docking-as-proximity-transaction.
- **Phase 4:** Ship progression. Upgrades, multiple ship classes, fuel management as real gameplay.
- **Phase 5:** Multiple systems, inter-system travel, galaxy map.
- **Future:** NPC traders, piracy, player interaction, the grand strategy layer.

# Space Trader — Technical Brief

## Project: StarryEyes (Working Title)

**Version:** 0.1 — Phase 1 Prototype
**Author:** Grimfox Games
**Date:** March 2026

---

## Vision

An io-style MMO space trading game set in a persistent, shared galaxy. Players start as lone traders navigating a Newtonian physics sandbox, buying and selling commodities between stations across a star system. The visual language is inspired by The Expanse — information-dense, iconographic, functional displays rather than cinematic 3D. Curved trajectory lines, orbital paths, readouts, and scanner displays *are* the aesthetic.

Long-term, the game expands into grand strategy territory (empire building, fleet management, territorial control), but that is a future phase. This brief covers only the foundational prototype: a single star system with Keplerian celestial bodies and a player-controlled ship with Newtonian thrust.

---

## Phase 1 Scope

Build a client-side prototype that proves out the core moment-to-moment experience: plotting thrust maneuvers in a Newtonian star system and watching your trajectory evolve in real time.

### What Phase 1 Includes

- A single star system (~100,000 km across) with a central star, several planets, moons, and an asteroid field, all on Keplerian orbits
- A player ship that can set a heading (direction vector) and thrust level (0–100%), with realistic Newtonian physics
- A real-time predictive trajectory line showing the ship's future path based on current state, updated continuously during thrust
- A trail line behind the ship showing where it has been
- Time compression (target: roughly 30–100x, tunable — a cross-system transit should take a few real-time minutes)
- Pause, speed up, slow down time controls
- An Expanse-inspired UI overlay: velocity readout, thrust percentage, fuel gauge, time compression indicator
- Zoomable map from full-system view down to local-body proximity
- No economy, no docking, no combat, no multiplayer — just flight

### What Phase 1 Does NOT Include

- Server-side anything (but architecture must support migration — see below)
- Other players or NPCs
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
│   ├── types.ts         # Core data types (Vec2, OrbitalElements, ShipState, etc.)
│   ├── constants.ts     # G, time scale, system scale, body masses
│   ├── kepler.ts        # Keplerian orbit math (elements ↔ state vectors, propagation)
│   ├── physics.ts       # Newtonian integration for thrusting ships
│   ├── system.ts        # Star system state: bodies, ships, simulation tick
│   └── commands.ts      # Player command interface (set heading, set thrust, etc.)
│
├── client/              # Browser-only, rendering and input
│   ├── renderer.ts      # PixiJS scene management
│   ├── camera.ts        # Pan, zoom, coordinate transforms
│   ├── trails.ts        # Ship trail and prediction line rendering
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

  // Client queries (for prediction lines, etc.)
  queryPosition(entityId: string, time: number): Vec2;
  predictTrajectory(shipId: string, steps: number): Vec2[];
}
```

In Phase 2, a `WebSocketBridge` implements the same interface, serializing commands as JSON messages and deserializing state updates. The client and simulation code remain untouched.

### The Simulation Loop

The simulation module exposes a `tick(dt: number)` function. In Phase 1, the client calls this from `requestAnimationFrame` scaled by time compression. In Phase 2, the server calls it from a `setInterval`. The simulation does not know or care who is calling it.

```typescript
// system.ts
class StarSystem {
  bodies: CelestialBody[];      // Planets, moons, asteroids — Keplerian
  ships: Ship[];                // Player ships — Newtonian when thrusting, Keplerian when coasting
  gameTime: number;             // Current game time in seconds (integer-safe range)

  tick(dt: number): SystemSnapshot {
    this.gameTime += dt;

    // Update Keplerian bodies (analytical — no integration, just evaluate at gameTime)
    for (const body of this.bodies) {
      body.position = keplerPositionAtTime(body.elements, this.gameTime);
    }

    // Update thrusting ships (numerical integration)
    for (const ship of this.ships) {
      if (ship.isThrusting) {
        integrateShip(ship, dt, this.bodies);  // Verlet or RK4
      } else {
        ship.position = keplerPositionAtTime(ship.coastOrbit, this.gameTime);
      }
    }

    return this.snapshot();
  }
}
```

---

## Physics Model

### Coordinate System

- Origin: system barycenter (central star)
- Units: meters for position, m/s for velocity, m/s² for acceleration
- 2D (top-down orbital plane) — sufficient for a trading game, dramatically simplifies physics and rendering
- At 100,000 km system radius, max coordinate value is 10^11 meters. 64-bit doubles provide sub-millimeter precision. No local frame transforms needed at this scale.

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

### Ships — Newtonian Under Thrust

A ship has two modes:

**Thrusting:** Numerically integrated each tick. The ship has a heading (unit vector) and thrust level (0–1). Acceleration = heading × thrustLevel × maxAcceleration. Gravity from the nearest dominant body is added. Use Velocity Verlet integration — stable, simple, sufficient for these timescales.

**Coasting:** When thrust is zero, convert current (position, velocity) into Keplerian orbital elements relative to the dominant body. Store elements. Evaluate analytically. No tick cost. When thrust resumes, convert back to state vectors and return to integration.

```typescript
interface Ship {
  id: string;
  position: Vec2;               // m, system-relative
  velocity: Vec2;               // m/s
  heading: Vec2;                // Unit vector, direction of thrust
  thrustLevel: number;          // 0.0 – 1.0
  maxAcceleration: number;      // m/s² (9.81 for 1g ship, ~29.4 for 3g)
  fuel: number;                 // kg of propellant remaining
  fuelConsumptionRate: number;  // kg/s at full thrust (scaled by thrustLevel)
  isThrusting: boolean;
  coastOrbit: OrbitalElements | null;  // Set when coasting, null when thrusting
}
```

### Gravity

Simplified dominant-body model. Each point in space is governed by one body's gravity (sphere of influence). For Phase 1, just the star's gravity everywhere is fine — planets are too small at this scale to matter much, and it keeps the physics clean. Gravity from the star:

```
a_gravity = -G * M_star / |r|² * r̂
```

Where r is the vector from star to ship. This is added to thrust acceleration each tick.

### Time Compression

Game time advances at a configurable multiplier of real time. Target range: 30x–100x (tunable at runtime via UI controls).

```typescript
const realDt = (Date.now() - lastRealTime) / 1000;  // seconds
const gameDt = realDt * timeCompression;
system.tick(gameDt);
```

Integration substeps may be needed at high compression to keep physics stable. If gameDt > some threshold (e.g., 60 game-seconds), subdivide into smaller steps.

Provide UI controls: pause, 1x, 10x, 30x, 60x, 100x. Show current compression and game clock prominently.

### Predictive Trajectory Line

This is the signature visual feature. At all times, render a dotted/dashed line ahead of the ship showing its predicted future path. Computed by running the physics forward from current state for N steps without modifying actual state.

```typescript
function predictTrajectory(ship: Ship, system: StarSystem, steps: number, stepDt: number): Vec2[] {
  // Clone ship state
  let pos = ship.position.clone();
  let vel = ship.velocity.clone();
  const points: Vec2[] = [pos.clone()];

  for (let i = 0; i < steps; i++) {
    // Same integration as real physics, but on cloned state
    const gravity = computeGravity(pos, system.bodies);
    const thrust = ship.isThrusting
      ? ship.heading.scale(ship.thrustLevel * ship.maxAcceleration)
      : Vec2.ZERO;
    const acc = gravity.add(thrust);
    vel = vel.add(acc.scale(stepDt));
    pos = pos.add(vel.scale(stepDt));
    points.push(pos.clone());
  }

  return points;
}
```

Update this every frame. During thrust, the line shifts dynamically — this IS the gameplay feedback. The player watches the prediction line and adjusts heading/thrust to shape their trajectory.

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
- **Prediction line:** Dashed, same color family as ship but lower opacity, extending forward from ship
- **Trail:** Solid thin line behind ship, fading to transparent over distance
- **Thrust indicator:** Visual cue on ship icon when engines are firing (glow, particle trail, or simple line extending opposite to heading)
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

Zoom level determines meters-per-pixel. At full zoom-out with 100,000 km system: roughly 100km per pixel on a 1000px viewport.

---

## Player Input → Commands

All player interaction with the simulation goes through a command interface. Never mutate simulation state directly from input handlers.

```typescript
type PlayerCommand =
  | { type: 'SET_HEADING'; shipId: string; heading: Vec2 }
  | { type: 'SET_THRUST'; shipId: string; level: number }
  | { type: 'SET_TIME_COMPRESSION'; multiplier: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' };
```

**Heading input:** Click a point in space → compute direction vector from ship to click point → issue SET_HEADING command. Or: click-drag from ship to set heading and thrust proportionally.

**Thrust input:** UI slider or keyboard shortcuts (0–9 for 0%–90%, shift+0 for 100%).

---

## Initial Star System Layout

A handcrafted test system for Phase 1. Not procedurally generated.

| Body | Type | Orbital Radius | Orbital Period (game time) | Mass | Notes |
|------|------|---------------|---------------------------|------|-------|
| Sol | Star | — | — | ~10^30 kg | Central body. Exact mass tuned to produce desired orbital periods at the compressed scale. |
| Tellus | Planet | ~20,000 km | Tuned to ~10 min game time | Minor | Inner rocky world. Starting area candidate. |
| Mara | Planet | ~45,000 km | Tuned to ~30 min game time | Minor | Mid-system. Asteroid belt nearby. |
| Jove | Planet | ~80,000 km | Tuned to ~60 min game time | Moderate | Outer gas giant. Has 1-2 moons. |
| Scattered asteroids | Asteroid field | ~35,000–55,000 km | Various | Negligible | Visual interest, future mining sites. |

Note: These are compressed-scale numbers. Tune masses and radii until orbital periods look and feel right at target time compression. The star's mass is a free parameter — set it to whatever makes the orbital mechanics produce satisfying timescales.

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

5. **Prediction line recomputation is the performance hot spot.** Profile this early. If it's too expensive every frame, recompute at lower frequency (every 5–10 frames) and interpolate visually.

6. **Coasting orbit conversion** (state vectors → Keplerian elements and back) should be implemented and tested early. This is the trickiest math in the system and needs to be bulletproof.

7. **Don't over-optimize Phase 1.** One system, one ship, a handful of bodies. Performance won't be an issue. Focus on correctness and feel.

---

## Success Criteria for Phase 1

The prototype is successful if:

- You can watch planets orbit the star on Keplerian paths at compressed time
- You can set a heading and thrust level and watch your ship accelerate
- The prediction line updates in real time during thrust and accurately reflects future trajectory
- Cutting engines converts to a Keplerian coast that matches the prediction line
- The trail shows your flight history
- Zooming in and out feels smooth and the system is legible at multiple scales
- The whole thing looks and feels like an Expanse tactical display
- Time compression controls work and the system remains stable across the range
- The codebase is cleanly separated such that `simulation/` could be dropped into a Node.js project and run without modification

---

## What Comes Next (Not In Scope Now)

For context only — do not build any of this in Phase 1:

- **Phase 2:** Server migration. Move simulation to Node.js, WebSocket bridge, multiple concurrent players in a system.
- **Phase 3:** Economy. Stations, commodities, buy/sell, docking-as-proximity-transaction.
- **Phase 4:** Ship progression. Upgrades, multiple ship classes, fuel management as real gameplay.
- **Phase 5:** Multiple systems, inter-system travel, galaxy map.
- **Future:** NPC traders, piracy, player interaction, the grand strategy layer.

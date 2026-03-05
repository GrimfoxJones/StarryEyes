# StarryEyes — Server Migration Technical Brief

**Version:** 0.1
**Author:** Grimfox Games
**Date:** March 2026
**Companion to:** Technical Brief, Navigation Refactor, Route Curves, Codebase Summary

---

## Goal

Migrate the simulation layer from the client to a Node.js server. The server is authoritative for game state (ship positions, fuel, routes, game time). The client sends commands via REST, receives computed routes in the response, and interpolates locally. The server pushes events (other ships, arrivals, time changes) to clients over WebSocket.

This is a prototype server — one process, one star system, in-memory state, no database. Build it right, but build it simple.

---

## Monorepo Structure

The project becomes three packages in a single repository. Use npm workspaces (or pnpm workspaces) so all three packages can import each other cleanly with TypeScript path resolution.

```
starryeyes/
├── package.json                  # Workspace root
├── tsconfig.base.json            # Shared TypeScript config
│
├── starry-eyes-shared/           # Shared simulation code (zero dependencies)
│   ├── package.json              # name: "@starryeyes/shared"
│   ├── tsconfig.json             # extends ../tsconfig.base.json
│   └── src/
│       ├── types.ts              # Vec2, OrbitalElements, CelestialBody, ShipState, Route, etc.
│       ├── constants.ts          # Physics constants, body definitions
│       ├── kepler.ts             # Kepler equation solver, orbital math
│       ├── nav.ts                # Bézier route computation, brachistochrone math
│       ├── soi.ts                # Sphere of influence calculations
│       └── index.ts              # Re-exports everything
│
├── starry-eyes-client/           # Existing client (PixiJS + React)
│   ├── package.json              # depends on @starryeyes/shared
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx              # Game loop (MODIFIED — no longer ticks simulation)
│       ├── bridge.ts             # ISimulationBridge + NEW RemoteBridge
│       ├── client/               # Rendering, HUD, input (mostly unchanged)
│       └── simulation/           # GUTTED — only system.ts remains for local state tracking
│
├── starry-eyes-server/           # NEW — Node.js server
│   ├── package.json              # depends on @starryeyes/shared
│   ├── tsconfig.json
│   └── src/
│       ├── main.ts               # Server bootstrap
│       ├── config.ts             # Port, tick rate, default time compression
│       ├── GameServer.ts         # Tick loop, state management, command processing
│       ├── api/                  # REST endpoint handlers
│       ├── websocket/            # WebSocket connection management, event broadcasting
│       └── auth.ts               # Lightweight session tokens
```

### What Moves to `starry-eyes-shared`

Everything in the current `simulation/` folder that is pure math with zero side effects:

| File | Description | Notes |
|------|-------------|-------|
| `types.ts` | Vec2, OrbitalElements, CelestialBody, ShipState, Route, SystemSnapshot, ShipSnapshot, BodySnapshot, PlayerCommand, DestinationTarget | The canonical type definitions used by both client and server. See the Technical Brief for full interface definitions. |
| `constants.ts` | STAR_MU, body definitions, ship defaults | Shared physics constants |
| `kepler.ts` | Kepler equation solver, position-at-time, state-to-elements, orbital ellipse computation | Pure math, no side effects |
| `nav.ts` | computeRoute, transitPositionAtTime, transitVelocityAtTime, sampleRouteAhead, brachistochroneTime | The nav computer. Server calls computeRoute; client calls transitPositionAtTime for interpolation |
| `soi.ts` | buildSOITable, determineSOIParent | Sphere of influence calculations |

**Do NOT move to shared:** `system.ts` (the StarSystem class with tick loop and mutable state) and `commands.ts` (the command processor that mutates system state). These contain game logic that must live on the server. The client does not need them.

**Do NOT move to shared:** `physics.ts` (currently unused Verlet integrator). Drop it or leave it in the client for reference.

### What Stays in the Client

All rendering, HUD, input, camera, trail recording, targeting animation. The client still imports `@starryeyes/shared` for:
- `transitPositionAtTime()` — to interpolate ship position along a cached route between server snapshots
- `transitVelocityAtTime()` — to derive heading direction for the ship chevron
- `sampleRouteAhead()` — to render the prediction line ahead of the ship
- `keplerPositionAtTime()` — to position celestial bodies between server snapshots
- `computeOrbitalEllipse()` — to render orbit paths
- All type definitions (Vec2, Route, SystemSnapshot, etc.)

### What's New on the Server

The server gets its own `GameServer` class that replaces the client's `StarSystem` + `commands.ts`. It:
- Owns the tick loop (server-side `setInterval`)
- Owns all mutable game state (ships, fuel, routes, game time)
- Processes commands received via REST
- Broadcasts events via WebSocket
- Imports `@starryeyes/shared` for all the same math the client uses

---

## Server Architecture

### GameServer — The Core

The `GameServer` class is the server's equivalent of the client's `StarSystem`. It holds all game state and advances the simulation.

**State it owns:**
- `gameTime: number` — the authoritative game clock (game seconds)
- `timeCompression: number` — current multiplier (default 100, adjustable for debug)
- `isPaused: boolean` — pause state (debug only)
- `bodies: CelestialBody[]` — the star system definition (static, loaded from constants)
- `ships: Map<string, Ship>` — all ships in the system, keyed by ship ID
- `players: Map<string, Player>` — connected players and their owned ship IDs

**Tick loop:**

The server ticks at a fixed real-time rate (20 Hz — every 50ms). Each tick:

1. Compute `gameDt = realDt × timeCompression`
2. Advance `gameTime += gameDt`
3. For each ship in transit: check if `gameTime >= route.arrivalTime`. If so, complete the transit (enter orbit or drift state) and queue an arrival event.
4. Body positions are NOT updated per-tick on the server — they're Keplerian and computed analytically on demand when needed (route computation, snapshot generation).
5. Every N ticks (e.g., every 10 ticks = 2 Hz), generate a lightweight snapshot and broadcast it to connected clients.

The server does NOT call `transitPositionAtTime` every tick for every ship. Ship positions during transit are deterministic from the route — the server only needs to check arrival conditions. Full position evaluation happens on-demand when generating snapshots or processing commands.

**Command processing:**

When a REST command arrives, the GameServer processes it synchronously:

- `SET_DESTINATION`: Read ship's current state. If in transit, extract current position and velocity from the active route at current gameTime using shared `transitPositionAtTime` and `transitVelocityAtTime`. Call shared `computeRoute` to generate new Bézier route. Validate fuel. Deduct fuel. Set ship state to transit with the new route. Return the route in the REST response.
- `CANCEL_ROUTE`: Extract current velocity from route at current gameTime using `transitVelocityAtTime`. Set ship to `drift` state with that position and velocity. The ship continues coasting with its current momentum until the player issues a new destination.
- `UNDOCK`: Set ship to orbit around station's parent body.
- `SET_TIME_COMPRESSION`: Update the server's timeCompression. Broadcast the change to all clients. This is a debug command — eventually gated behind an admin key.
- `PAUSE` / `RESUME`: Toggle `isPaused`. Broadcast. Also debug-only.

### Server Tick Rate Discussion

20 Hz is more than enough. The server isn't doing per-frame physics integration — it's just checking arrival times and occasionally generating snapshots. The expensive work (route computation) happens on-demand when a command arrives, not every tick.

Snapshot broadcast rate should be lower than tick rate. 2 Hz (every 500ms) is sufficient for the client to stay in sync. Between snapshots, the client interpolates locally using cached routes and Kepler math from the shared package.

---

## REST API

All commands are transactional: client sends a request, server processes it, server sends a response. The response contains everything the client needs to proceed without further server interaction.

### Authentication

Lightweight for prototype. No passwords, no database.

```
POST /api/auth/join
  Request:  { playerName: string }
  Response: { playerId: string, sessionToken: string, shipId: string, gameTime: number, timeCompression: number }
```

The server creates a player record, spawns a ship for them (in orbit around Tellus), and returns a session token. All subsequent requests include `Authorization: Bearer <token>`.

```
POST /api/auth/leave
  Response: { ok: true }
```

Cleanup. Remove player session. Ship persists in the world (or despawns — your call for prototype).

### State Queries

```
GET /api/state
  Response: SystemSnapshot
```

Full snapshot: game time, time compression, all body positions, all ship states. The client calls this once on connect to bootstrap, then relies on WebSocket pushes for updates.

```
GET /api/bodies
  Response: { bodies: BodySnapshot[] }
```

Static system layout. Bodies don't change — this is a one-time fetch on connect. Includes orbital elements so the client can compute body positions locally.

```
GET /api/ships
  Response: { ships: ShipSnapshot[] }
```

Current state of all ships the player can see. Includes full route data for ships in transit.

### Navigation Commands

```
POST /api/commands/set-destination
  Request:  { shipId: string, target: DestinationTarget }
  Response: {
    success: true,
    route: Route,           // Full Bézier route: P0, P1, P2, arc length table, timing
    fuelConsumed: number,   // Fuel deducted
    fuelRemaining: number,  // New fuel level
    ship: ShipSnapshot      // Updated ship state
  }
  Errors:
    400 — invalid target (body doesn't exist, can't reach from current state)
    409 — insufficient fuel
    403 — not your ship
```

This is the critical endpoint. The response contains the complete Route object — the client caches it and uses `transitPositionAtTime()` from `@starryeyes/shared` to interpolate the ship's position locally at 60fps. No further server interaction needed during transit.

```
POST /api/commands/cancel-route
  Request:  { shipId: string }
  Response: {
    success: true,
    ship: ShipSnapshot,     // Now in drift state
    velocity: Vec2          // Current velocity at time of cancellation
  }
```

```
POST /api/commands/undock
  Request:  { shipId: string }
  Response: {
    success: true,
    ship: ShipSnapshot      // Now in orbit state
  }
```

### Debug Commands

These are the time compression and pause controls. They affect the entire server (all players). Gate behind an admin key in production.

```
POST /api/debug/set-time-compression
  Request:  { factor: number }
  Response: { timeCompression: number, gameTime: number }
  Side effect: broadcasts EVENT_TIME_COMPRESSION_CHANGED to all WebSocket clients
```

```
POST /api/debug/pause
  Response: { isPaused: true, gameTime: number }
  Side effect: broadcasts EVENT_PAUSED

POST /api/debug/resume
  Response: { isPaused: false, gameTime: number }
  Side effect: broadcasts EVENT_RESUMED
```

The +/- keys on the client should send `POST /api/debug/set-time-compression` with the next step up or down. Keep the existing step ladder (1×, 10×, 100×, 1k×, 5k×, 10k×, 50k×, 100k×) but change the default to 100×.

---

## WebSocket Events

The server pushes events to connected clients over a persistent WebSocket connection. The client connects on startup and stays connected.

### Connection Flow

1. Client opens WebSocket to `ws://server:port/ws`
2. Client sends an auth message: `{ type: "AUTH", sessionToken: "..." }`
3. Server validates the token and associates the WebSocket connection with the player
4. Server begins pushing events

### Event Format

Every event is a JSON message:

```typescript
interface ServerEvent {
  type: string;
  gameTime: number;     // Server's game time when the event was generated
  data: any;            // Event-specific payload
}
```

### Event Types

**System Snapshot (periodic)**

```
EVENT_SNAPSHOT
  Frequency: ~2 Hz (every 500ms real time)
  Data: {
    gameTime: number,
    timeCompression: number,
    ships: ShipSnapshot[]    // All ships visible to this player
  }
```

This is the heartbeat. The client uses it to sync game time and correct any drift in local interpolation. Body positions are NOT included — the client computes those locally from orbital elements. Ship snapshots include position, velocity, mode, fuel, and route data.

Note: at 2 Hz with, say, 100 concurrent players each seeing 5-10 ships, this is roughly 200 messages/second across all connections. Each message is small (a few KB of JSON). Trivial load.

**Ship Events (on state change)**

```
EVENT_SHIP_ROUTE_CHANGED
  When: A ship sets a new destination (including redirects)
  Data: { shipId, route: Route, targetBodyId?: string }

EVENT_SHIP_ARRIVED
  When: A ship completes its transit
  Data: { shipId, newState: ShipState, position: Vec2 }

EVENT_SHIP_DEPARTED
  When: A ship undocks or leaves orbit
  Data: { shipId, newState: ShipState, route?: Route }

EVENT_SHIP_CANCELLED
  When: A ship cancels its route
  Data: { shipId, newState: ShipState, velocity: Vec2 }
```

These fire immediately when the state change happens, independent of the snapshot cycle. The client for the commanding player already has the data from the REST response — these events are for OTHER clients who need to see the change.

**Time Control Events (debug)**

```
EVENT_TIME_COMPRESSION_CHANGED
  When: Admin changes time compression
  Data: { factor: number, gameTime: number }

EVENT_PAUSED
  When: Admin pauses
  Data: { gameTime: number }

EVENT_RESUMED
  When: Admin resumes
  Data: { gameTime: number }
```

All connected clients receive these. The client updates its local time compression value to stay in sync with the server clock.

**Player Events**

```
EVENT_PLAYER_JOINED
  Data: { playerId, playerName, shipId }

EVENT_PLAYER_LEFT
  Data: { playerId }
```

**Future Events (not in this phase)**

- `EVENT_CONTACT_DETECTED` / `EVENT_CONTACT_LOST` — sensor system, when other ships enter/leave detection range
- `EVENT_CHAT_MESSAGE` — player chat
- `EVENT_MARKET_UPDATE` — commodity price changes

---

## Client Changes

### New Bridge: RemoteBridge

Replace `LocalBridge` with `RemoteBridge` that talks to the server. The `ISimulationBridge` interface from `bridge.ts` stays the same — the client code that calls it doesn't change.

```typescript
class RemoteBridge implements ISimulationBridge {
  private ws: WebSocket;
  private cachedRoutes: Map<string, Route>;
  private latestSnapshot: SystemSnapshot;

  async sendCommand(cmd: PlayerCommand): Promise<CommandResult> {
    // POST to the appropriate REST endpoint
    // Cache the returned route
    // Return the result
  }

  // Called by WebSocket message handler
  onEvent(event: ServerEvent) {
    switch (event.type) {
      case 'EVENT_SNAPSHOT':
        this.latestSnapshot = event.data;
        this.notifyStateUpdate(event.data);
        break;
      case 'EVENT_SHIP_ROUTE_CHANGED':
        this.cachedRoutes.set(event.data.shipId, event.data.route);
        break;
      case 'EVENT_TIME_COMPRESSION_CHANGED':
        // Update local time compression for interpolation
        break;
      // ... etc
    }
  }
}
```

### Game Loop Changes

The client game loop no longer calls `system.tick()`. Instead:

**Old loop (every frame):**
1. Compute dt
2. Apply time compression → gameDt
3. `system.tick(gameDt)` ← **REMOVE THIS**
4. Record trail, update prediction, render

**New loop (every frame):**
1. Compute dt
2. Estimate local game time: `localGameTime = lastServerGameTime + (realTimeSinceSnapshot × timeCompression)`
3. For the player's ship in transit: call `transitPositionAtTime(cachedRoute, localGameTime)` from `@starryeyes/shared` to get interpolated position
4. For celestial bodies: call `keplerPositionAtTime(elements, localGameTime)` from `@starryeyes/shared`
5. For other ships in transit: same interpolation from their cached routes (received via WebSocket events)
6. Record trail, update prediction, render — same as before

When a `EVENT_SNAPSHOT` arrives from the server, the client snaps to the server's authoritative game time. Any small drift from local interpolation is corrected. This should be imperceptible — the math is deterministic, so local interpolation and server state should agree to floating-point precision.

### Input Changes

- **Right-click destination:** Instead of calling `bridge.sendCommand()` synchronously, sends `POST /api/commands/set-destination` asynchronously. On response, caches the route and starts rendering it. There will be a brief network delay before the route appears — acceptable for now. If it feels sluggish later, we can optimistically compute the route client-side and verify with the server.
- **+/- time compression:** Sends `POST /api/debug/set-time-compression` with the next step. Client doesn't change its local time compression until it receives `EVENT_TIME_COMPRESSION_CHANGED` from the server.
- **Space (pause/resume):** Sends `POST /api/debug/pause` or `/resume`. Same — wait for server confirmation.

### What Doesn't Change on the Client

- All PixiJS rendering (bodies, orbits, ship, route line, trail, prediction)
- Camera (pan, zoom, focus tracking)
- Targeting reticle animation
- React HUD (reads from Zustand store, which is fed by RemoteBridge)
- Left panel tabs and navigation
- Popups and modals
- Trail recording (client-side ring buffer)
- Prediction line sampling (uses `sampleRouteAhead` from shared)

---

## Shared Package Design

`@starryeyes/shared` must have **zero runtime dependencies**. It is pure TypeScript with pure functions and type definitions. It must run identically in the browser (client) and Node.js (server).

**Exported modules:**

- `types` — all interfaces and type definitions
- `kepler` — Kepler equation solver, orbital math
- `nav` — route computation, position/velocity evaluation, prediction sampling
- `soi` — sphere of influence
- `constants` — physics constants, body definitions

**Build:** Compile to ES modules. Both client (Vite) and server (Node.js with ESM) import directly. The workspace `package.json` sets up the dependency so imports work as `import { computeRoute } from '@starryeyes/shared'`.

**No mutable state in shared.** Every function takes inputs and returns outputs. The GameServer and the client each maintain their own state and call into shared functions as needed.

**ShipSnapshot** (sent in snapshots and command responses):
```typescript
interface ShipSnapshot {
  id: string;
  position: Vec2;
  velocity: Vec2;          // Direction from Bézier tangent, magnitude from accel profile
  fuel: number;
  mode: 'docked' | 'orbit' | 'transit' | 'drift';
  route?: Route;           // Included when mode === 'transit'
  orbitBodyId?: string;    // Included when mode === 'orbit'
  stationId?: string;      // Included when mode === 'docked'
}
```

**Codebase note: consolidate `idle` and `drift`.** The current codebase has both `idle` (stationary, zero velocity) and `drift` (coasting with a velocity vector) as separate modes. Consolidate these into a single `drift` mode that carries a velocity vector. A ship at rest has velocity `(0, 0)` — it's still `drift`, just not going anywhere. `drift` is the correct term: it describes a ship with no active route, coasting on whatever momentum it has.

---

## Server Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Runtime | Node.js | Match client's TypeScript ecosystem |
| Language | TypeScript | Strict mode, same tsconfig base as client |
| HTTP | Express | Simple, well-known, sufficient for REST |
| WebSocket | ws (npm package) | Lightweight, no Socket.IO overhead. Raw WebSocket. |
| Build | tsx or ts-node | For dev. Compile to JS for production. |
| Auth | UUID session tokens | In-memory Map. No JWT, no database — prototype only. |
| State | In-memory | All game state lives in GameServer instance. Server restart = state loss. Fine for prototype. |

---

## Data Flow Summary

### On Player Connect
```
Client                          Server
  │                               │
  ├─ POST /api/auth/join ────────→│ Create player, spawn ship
  │←──── { playerId, token, ──────┤
  │       shipId, gameTime }      │
  │                               │
  ├─ GET /api/bodies ────────────→│ Return static system layout
  │←──── { bodies[] } ───────────┤ (orbital elements, masses, radii)
  │                               │
  ├─ GET /api/state ─────────────→│ Return full current snapshot
  │←──── { snapshot } ───────────┤
  │                               │
  ├─ WS connect /ws ─────────────→│ Open persistent connection
  ├─ WS { AUTH, token } ─────────→│ Associate WS with player
  │                               │
  │←──── EVENT_SNAPSHOT ──────────┤ (every ~500ms from here on)
  │←──── EVENT_SHIP_* ────────────┤ (as they happen)
```

### On Set Destination
```
Client                          Server
  │                               │
  ├─ POST set-destination ───────→│ Compute route (using @starryeyes/shared)
  │                               │ Validate fuel, deduct fuel
  │                               │ Set ship state to transit
  │←──── { route, fuel, ship } ──┤
  │                               │
  │ Cache route locally            │ Broadcast EVENT_SHIP_ROUTE_CHANGED
  │ Start rendering route line     │ to other connected clients
  │ Start interpolating position   │
  │                               │
  │ ... time passes ...            │ ... server ticks ...
  │ (client interpolates locally   │ (server checks arrivalTime)
  │  using transitPositionAtTime)  │
  │                               │
  │←── EVENT_SHIP_ARRIVED ────────┤ Ship reached destination
  │ Update ship state to orbit     │
```

### Between Snapshots (Client Interpolation)
```
Server snapshot at T=1000.0 ──→ Client receives, sets baseline
  │
  │  Frame 1: localTime = 1000.0 + (16ms × 100x) = 1001.6
  │    → transitPositionAtTime(route, 1001.6) → render ship here
  │
  │  Frame 2: localTime = 1001.6 + (16ms × 100x) = 1003.2
  │    → transitPositionAtTime(route, 1003.2) → render ship here
  │
  │  ... 30 more frames ...
  │
Server snapshot at T=1050.0 ──→ Client snaps to T=1050.0, corrects any drift
```

---

## Migration Sequence

### Step 1: Create the shared package

Extract `types.ts`, `constants.ts`, `kepler.ts`, `nav.ts`, `soi.ts` from `starry-eyes-client/src/simulation/` into `starry-eyes-shared/src/`. Set up the workspace so both packages can import it. Update the client's imports to use `@starryeyes/shared`. Verify the client still works exactly as before — this is a refactor, not a behavior change.

### Step 2: Build the server skeleton

Express + ws server. Auth endpoints (join/leave). WebSocket connection handler. GameServer class with tick loop that creates bodies from shared constants, manages ships in memory, and advances game time. State query endpoints (GET /api/state, /api/bodies, /api/ships). No command processing yet — just a running world with orbiting planets.

### Step 3: Add command processing

POST /api/commands/set-destination, cancel-route, undock. GameServer calls into `@starryeyes/shared` nav.computeRoute. Returns route in response. WebSocket broadcast of ship events. Debug endpoints for time compression and pause.

### Step 4: Build RemoteBridge on the client

New `RemoteBridge` class implementing `ISimulationBridge`. REST calls for commands, WebSocket listener for events. Route caching. Local interpolation using shared math. Swap `LocalBridge` for `RemoteBridge` in `main.tsx`. Remove `system.tick()` from the client game loop.

### Step 5: Verify

Client connects to server, receives initial state, renders the system. Right-click a planet — REST command goes to server, route comes back, client renders and interpolates. Time compression change propagates via WebSocket. Multiple browser tabs connect to the same server and see the same world.

---

## Things to Watch Out For

**Game time sync.** The client interpolates between server snapshots using local clock × timeCompression. If the client's clock drifts from the server's, positions will diverge slightly. The periodic snapshot corrects this — but make sure the correction is smooth (lerp to server time, don't snap). In practice, since both are using the same math on the same route data, divergence should be negligible.

**Route computation latency.** The REST round-trip for set-destination adds network latency before the route appears on screen. For local development this is <10ms and invisible. On a real network (50-100ms), the player right-clicks and the route appears a moment later. This is acceptable — the game's pace is slow. If it ever feels bad, we can add optimistic client-side route computation (compute locally, render immediately, verify with server response).

**Time compression changes.** When the server changes time compression, all clients must update simultaneously. The EVENT_TIME_COMPRESSION_CHANGED broadcast includes the server's exact gameTime at the moment of change. The client sets its baseline time to this value and begins interpolating with the new factor. This prevents time jumps.

**Arrival race condition.** The server detects arrival when `gameTime >= route.arrivalTime`. The client might locally interpolate past the arrival time before receiving `EVENT_SHIP_ARRIVED`. Handle this gracefully — if the client's local time exceeds arrivalTime, clamp the ship to the destination and wait for the server event to confirm the new state.

**Fuel.** Fuel is server-authoritative. The client displays the fuel value from the latest snapshot or command response. The client never deducts fuel locally.

---

## What This Brief Does NOT Cover

- Economy (trading, buy/sell) — future phase
- Sensor/detection system integration — will use existing sensor design doc when ready
- Chat system — future, straightforward addition to WebSocket events
- Database persistence — prototype uses in-memory state
- Horizontal scaling — single server process for now
- Player accounts — prototype uses ephemeral session tokens
- Combat — future phase
- NPC ships — future phase

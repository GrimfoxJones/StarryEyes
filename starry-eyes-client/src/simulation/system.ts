import type {
  CelestialBody,
  ShipState,
  SystemSnapshot,
  PlayerCommand,
  Vec2,
} from './types.ts';
import { vec2, vec2Add, vec2Length, vec2Normalize, vec2Scale, Vec2Zero } from './types.ts';
import { keplerPositionAtTime } from './kepler.ts';
import { processCommand } from './commands.ts';
import { transitPositionAtTime, sampleRouteAhead } from './nav.ts';
import {
  G,
  STAR_MU,
  STAR_MASS,
  SHIP_MAX_ACCELERATION,
  SHIP_FUEL_CAPACITY,
  SHIP_FUEL_CONSUMPTION_RATE,
  ORBIT_VISUAL_RADIUS,
  ORBIT_VISUAL_SPEED,
} from './constants.ts';

// ── Body definitions ────────────────────────────────────────────────

function makeBody(
  id: string,
  name: string,
  type: CelestialBody['type'],
  mass: number,
  radius: number,
  color: number,
  parentId: string | null,
  a: number,
  e: number,
  omega: number,
  M0: number,
  mu: number,
): CelestialBody {
  return {
    id, name, type, mass, radius, color, parentId,
    elements: { a, e, omega, M0, epoch: 0, mu, direction: 1 },
  };
}

function createBodies(): CelestialBody[] {
  const sol: CelestialBody = {
    id: 'sol', name: 'Sol', type: 'star',
    mass: STAR_MASS, radius: 6.96e8, color: 0xffdd44,
    elements: null, parentId: null,
  };

  const tellus = makeBody('tellus', 'Tellus', 'planet', 5.972e24, 6.371e6, 0x4488ff,
    'sol', 1.496e11, 0.017, 1.796, 0, STAR_MU);

  const mara = makeBody('mara', 'Mara', 'planet', 6.39e23, 3.39e6, 0xcc6644,
    'sol', 2.279e11, 0.093, 5.0, 2.0, STAR_MU);

  const jove = makeBody('jove', 'Jove', 'planet', 1.898e27, 6.99e7, 0xddaa66,
    'sol', 7.785e11, 0.049, 4.8, 4.0, STAR_MU);

  const joveMu = G * 1.898e27;
  const europa = makeBody('europa', 'Europa', 'moon', 4.8e22, 1.56e6, 0xaaccff,
    'jove', 6.709e8, 0.009, 0, 0, joveMu);
  const ganymede = makeBody('ganymede', 'Ganymede', 'moon', 1.48e23, 2.63e6, 0xccbbaa,
    'jove', 1.0704e9, 0.0013, 1.0, 1.5, joveMu);

  const asteroids: CelestialBody[] = [];
  const rng = seedRng(42);
  for (let i = 0; i < 15; i++) {
    const a = 3.3e11 + rng() * 1.6e11;
    asteroids.push(makeBody(
      `asteroid_${i}`, `AST-${i + 1}`, 'asteroid', 1e15, 5e4, 0x888888,
      'sol', a, 0.01 + rng() * 0.15, rng() * Math.PI * 2, rng() * Math.PI * 2, STAR_MU,
    ));
  }

  return [sol, tellus, mara, jove, europa, ganymede, ...asteroids];
}

function seedRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Ship initialization ─────────────────────────────────────────────

function createPlayerShip(bodies: CelestialBody[], gameTime: number): ShipState {
  const tellus = bodies.find(b => b.id === 'tellus')!;
  const tellusPos = keplerPositionAtTime(tellus.elements!, gameTime);

  return {
    id: 'player',
    position: vec2Add(tellusPos, vec2(ORBIT_VISUAL_RADIUS, 0)),
    velocity: Vec2Zero,
    maxAcceleration: SHIP_MAX_ACCELERATION,
    fuel: SHIP_FUEL_CAPACITY,
    fuelConsumptionRate: SHIP_FUEL_CONSUMPTION_RATE,
    mode: 'orbit',
    route: null,
    orbitBodyId: 'tellus',
    orbitAngle: 0,
  };
}

// ── StarSystem ──────────────────────────────────────────────────────

export class StarSystem {
  bodies: CelestialBody[];
  ships: ShipState[];
  gameTime: number;
  paused: boolean;
  timeCompression: number;

  bodyPositions: Map<string, Vec2> = new Map();

  constructor() {
    this.bodies = createBodies();
    this.gameTime = 0;
    this.paused = false;
    this.timeCompression = 10000;
    this.updateBodyPositions();
    this.ships = [createPlayerShip(this.bodies, this.gameTime)];
  }

  getBodyPosition(bodyId: string): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    return this.bodyPositions.get(bodyId) ?? Vec2Zero;
  }

  /** Compute global position of any body at arbitrary future time. */
  bodyPositionAtTime(bodyId: string, t: number): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    const body = this.bodies.find(b => b.id === bodyId);
    if (!body || !body.elements) return Vec2Zero;

    if (body.parentId && body.parentId !== 'sol') {
      // Moon: parent position at time t + local orbital position
      const parentPos = this.bodyPositionAtTime(body.parentId, t);
      const localPos = keplerPositionAtTime(body.elements, t);
      return vec2Add(parentPos, localPos);
    }

    return keplerPositionAtTime(body.elements, t);
  }

  private updateBodyPositions(): void {
    for (const body of this.bodies) {
      if (body.elements === null) {
        this.bodyPositions.set(body.id, Vec2Zero);
      } else if (body.parentId && body.parentId !== 'sol') {
        const parentPos = this.bodyPositions.get(body.parentId) ?? Vec2Zero;
        const localPos = keplerPositionAtTime(body.elements, this.gameTime);
        this.bodyPositions.set(body.id, vec2Add(parentPos, localPos));
      } else {
        this.bodyPositions.set(body.id, keplerPositionAtTime(body.elements, this.gameTime));
      }
    }
  }

  command(cmd: PlayerCommand): void {
    processCommand(this, cmd);
  }

  tick(dt: number): SystemSnapshot {
    if (this.paused) return this.snapshot();

    this.gameTime += dt;
    this.updateBodyPositions();

    for (const ship of this.ships) {
      switch (ship.mode) {
        case 'transit': {
          if (!ship.route) {
            ship.mode = 'idle';
            break;
          }

          const elapsed = this.gameTime - ship.route.startTime;

          if (elapsed >= ship.route.totalTime) {
            // Arrival
            if (ship.route.targetBodyId) {
              const bodyPos = this.getBodyPosition(ship.route.targetBodyId);
              ship.position = vec2Add(bodyPos, vec2(ORBIT_VISUAL_RADIUS, 0));
              ship.mode = 'orbit';
              ship.orbitBodyId = ship.route.targetBodyId;
              ship.orbitAngle = 0;
            } else {
              ship.position = ship.route.interceptPos;
              ship.mode = 'idle';
            }
            ship.velocity = Vec2Zero;
            ship.route = null;
          } else {
            const result = transitPositionAtTime(ship.route, this.gameTime);
            ship.position = result.position;
            ship.velocity = result.velocity;
          }
          break;
        }

        case 'orbit': {
          if (!ship.orbitBodyId) {
            ship.mode = 'idle';
            break;
          }

          // Use real dt for smooth visual rotation regardless of time compression
          const realDt = dt / this.timeCompression;
          ship.orbitAngle += ORBIT_VISUAL_SPEED * realDt;

          const bodyPos = this.getBodyPosition(ship.orbitBodyId);
          ship.position = vec2Add(bodyPos, vec2(
            ORBIT_VISUAL_RADIUS * Math.cos(ship.orbitAngle),
            ORBIT_VISUAL_RADIUS * Math.sin(ship.orbitAngle),
          ));
          ship.velocity = Vec2Zero;
          break;
        }

        case 'drift': {
          ship.position = vec2Add(ship.position, vec2Scale(ship.velocity, dt));
          break;
        }

        case 'idle':
          // No-op
          break;
      }
    }

    return this.snapshot();
  }

  snapshot(): SystemSnapshot {
    return {
      gameTime: this.gameTime,
      paused: this.paused,
      timeCompression: this.timeCompression,
      bodies: this.bodies.map(b => ({
        id: b.id,
        name: b.name,
        type: b.type,
        position: this.bodyPositions.get(b.id) ?? Vec2Zero,
        radius: b.radius,
        color: b.color,
        elements: b.elements,
        parentId: b.parentId,
      })),
      ships: this.ships.map(s => {
        let isDecelerating = false;
        let heading: Vec2 = vec2(1, 0);

        if (s.route) {
          const result = transitPositionAtTime(s.route, this.gameTime);
          heading = result.heading;
          isDecelerating = result.isDecelerating;
        } else if (s.mode === 'drift' && vec2Length(s.velocity) > 1e-6) {
          heading = vec2Normalize(s.velocity);
        }

        // Destination name
        let destinationName: string | null = null;
        if (s.route) {
          if (s.route.targetBodyId) {
            const body = this.bodies.find(b => b.id === s.route!.targetBodyId);
            destinationName = body ? body.name : s.route.targetBodyId;
          } else {
            destinationName = 'SPACE';
          }
        }

        // ETA
        let eta: number | null = null;
        if (s.route) {
          eta = Math.max(0, s.route.totalTime - (this.gameTime - s.route.startTime));
        }

        // Route line: sample the Bézier curve ahead
        const routeLine = s.route ? sampleRouteAhead(s.route, this.gameTime, 20) : null;

        return {
          id: s.id,
          position: s.position,
          velocity: s.velocity,
          heading,
          mode: s.mode,
          fuel: s.fuel,
          maxFuel: SHIP_FUEL_CAPACITY,
          speed: vec2Length(s.velocity),
          destinationName,
          eta,
          routeLine,
          isDecelerating,
        };
      }),
    };
  }

  predictTrajectory(shipId: string): Vec2[] {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship || !ship.route) return [];
    return sampleRouteAhead(ship.route, this.gameTime, 30);
  }
}

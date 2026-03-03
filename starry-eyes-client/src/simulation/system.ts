import type {
  CelestialBody,
  ShipState,
  SystemSnapshot,
  PlayerCommand,
  Vec2,
} from './types.ts';
import { vec2, vec2Length, Vec2Zero } from './types.ts';
import { keplerPositionAtTime, keplerStateAtTime, stateToElements } from './kepler.ts';
import { integrateShipStep } from './physics.ts';
import { processCommand } from './commands.ts';
import {
  STAR_MU,
  STAR_MASS,
  MAX_SUBSTEP_DT,
  SHIP_MAX_ACCELERATION,
  SHIP_FUEL_CAPACITY,
  SHIP_FUEL_CONSUMPTION_RATE,
  PREDICTION_STEPS,
  PREDICTION_STEP_DT,
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
    elements: { a, e, omega, M0, epoch: 0, mu },
  };
}

function createBodies(): CelestialBody[] {
  // Star
  const sol: CelestialBody = {
    id: 'sol', name: 'Sol', type: 'star',
    mass: STAR_MASS, radius: 5e8, color: 0xffdd44,
    elements: null, parentId: null,
  };

  // Planets — a in meters, orbiting Sol
  const tellus = makeBody('tellus', 'Tellus', 'planet', 1e24, 6e6, 0x4488ff,
    'sol', 2e10, 0.02, 0.5, 0, STAR_MU);
  // T(tellus) ≈ 600s by construction

  const mara = makeBody('mara', 'Mara', 'planet', 5e23, 4e6, 0xcc6644,
    'sol', 4.5e10, 0.05, 1.2, 2.0, STAR_MU);

  const jove = makeBody('jove', 'Jove', 'planet', 1e26, 2e7, 0xddaa66,
    'sol', 8e10, 0.03, 0.8, 4.0, STAR_MU);

  // Moons of Jove — orbit Jove, mu = G*M_jove
  const joveMu = 6.674e-11 * 1e26;
  const europa = makeBody('europa', 'Europa', 'moon', 1e20, 1e6, 0xaaccff,
    'jove', 5e8, 0.01, 0, 0, joveMu);
  const ganymede = makeBody('ganymede', 'Ganymede', 'moon', 2e20, 1.5e6, 0xccbbaa,
    'jove', 1e9, 0.02, 1.0, 1.5, joveMu);

  // Asteroids scattered between Mara and Jove orbits
  const asteroids: CelestialBody[] = [];
  const rng = seedRng(42);
  for (let i = 0; i < 15; i++) {
    const a = 3.5e10 + rng() * 2e10; // 35,000–55,000 km range
    asteroids.push(makeBody(
      `asteroid_${i}`, `AST-${i + 1}`, 'asteroid', 1e15, 5e4, 0x888888,
      'sol', a, 0.01 + rng() * 0.1, rng() * Math.PI * 2, rng() * Math.PI * 2, STAR_MU,
    ));
  }

  return [sol, tellus, mara, jove, europa, ganymede, ...asteroids];
}

/** Simple seeded PRNG (mulberry32) for reproducible asteroid placement */
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
  // Place ship near Tellus with matching orbital velocity
  const tellus = bodies.find(b => b.id === 'tellus')!;
  const tellusElements = tellus.elements!;

  // Offset ship slightly from Tellus (5e8 m higher orbit)
  const shipA = tellusElements.a + 5e8;
  const shipElements = { ...tellusElements, a: shipA };
  const shipState = keplerStateAtTime(shipElements, gameTime);

  return {
    id: 'player',
    position: shipState.pos,
    velocity: shipState.vel,
    heading: vec2(1, 0),
    thrustLevel: 0,
    maxAcceleration: SHIP_MAX_ACCELERATION,
    fuel: SHIP_FUEL_CAPACITY,
    fuelConsumptionRate: SHIP_FUEL_CONSUMPTION_RATE,
    isThrusting: false,
    coastOrbit: { ...tellusElements, a: shipA, epoch: gameTime, M0: 0 },
  };
}

// ── StarSystem ──────────────────────────────────────────────────────

export class StarSystem {
  bodies: CelestialBody[];
  ships: ShipState[];
  gameTime: number;
  paused: boolean;
  timeCompression: number;

  // Cached body positions (updated each tick)
  bodyPositions: Map<string, Vec2> = new Map();

  constructor() {
    this.bodies = createBodies();
    this.gameTime = 0;
    this.paused = false;
    this.timeCompression = 30;
    this.ships = [createPlayerShip(this.bodies, this.gameTime)];

    // Initialize positions
    this.updateBodyPositions();

    // Initialize ship coast orbit properly
    const ship = this.ships[0];
    const shipOrbit = this.computeShipCoastOrbit(ship);
    ship.coastOrbit = shipOrbit;
  }

  computeShipCoastOrbit(ship: ShipState) {
    return stateToElements(ship.position, ship.velocity, STAR_MU, this.gameTime);
  }

  private updateBodyPositions(): void {
    for (const body of this.bodies) {
      if (body.elements === null) {
        // Star at origin
        this.bodyPositions.set(body.id, Vec2Zero);
      } else if (body.parentId && body.parentId !== 'sol') {
        // Moon: compute position relative to parent, then add parent position
        const parentPos = this.bodyPositions.get(body.parentId) ?? Vec2Zero;
        const localPos = keplerPositionAtTime(body.elements, this.gameTime);
        this.bodyPositions.set(body.id, vec2(
          parentPos.x + localPos.x,
          parentPos.y + localPos.y,
        ));
      } else {
        // Planet/asteroid orbiting sol
        this.bodyPositions.set(body.id, keplerPositionAtTime(body.elements, this.gameTime));
      }
    }
  }

  command(cmd: PlayerCommand): void {
    processCommand(this, cmd);
  }

  tick(dt: number): SystemSnapshot {
    if (this.paused) return this.snapshot();

    // Substep for stability
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(remaining, MAX_SUBSTEP_DT);
      this.gameTime += step;

      // Update body positions analytically
      this.updateBodyPositions();

      // Update ships
      for (const ship of this.ships) {
        if (ship.isThrusting && ship.fuel > 0) {
          integrateShipStep(ship, step, STAR_MU);
        } else if (ship.coastOrbit) {
          const state = keplerStateAtTime(ship.coastOrbit, this.gameTime);
          ship.position = state.pos;
          ship.velocity = state.vel;
        }
      }

      remaining -= step;
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
      })),
      ships: this.ships.map(s => ({
        id: s.id,
        position: s.position,
        velocity: s.velocity,
        heading: s.heading,
        thrustLevel: s.thrustLevel,
        isThrusting: s.isThrusting,
        fuel: s.fuel,
        maxFuel: SHIP_FUEL_CAPACITY,
        speed: vec2Length(s.velocity),
      })),
    };
  }

  /** Predict trajectory for a ship (forward-integration without modifying state) */
  predictTrajectory(shipId: string, steps: number = PREDICTION_STEPS, stepDt: number = PREDICTION_STEP_DT): Vec2[] {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship) return [];

    const points: Vec2[] = [{ x: ship.position.x, y: ship.position.y }];
    let px = ship.position.x;
    let py = ship.position.y;
    let vx = ship.velocity.x;
    let vy = ship.velocity.y;

    for (let i = 0; i < steps; i++) {
      // Gravity from star (at origin)
      const r2 = px * px + py * py;
      const r = Math.sqrt(r2);
      const gMag = -STAR_MU / r2;
      const ax = gMag * px / r + (ship.isThrusting ? ship.heading.x * ship.thrustLevel * ship.maxAcceleration : 0);
      const ay = gMag * py / r + (ship.isThrusting ? ship.heading.y * ship.thrustLevel * ship.maxAcceleration : 0);

      // Euler integration (fast, approximate — fine for prediction)
      vx += ax * stepDt;
      vy += ay * stepDt;
      px += vx * stepDt;
      py += vy * stepDt;

      points.push({ x: px, y: py });
    }

    return points;
  }
}

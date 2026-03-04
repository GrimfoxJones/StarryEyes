import type {
  CelestialBody,
  ShipState,
  SystemSnapshot,
  PlayerCommand,
  Vec2,
} from './types.ts';
import { vec2, vec2Add, vec2Sub, vec2Length, Vec2Zero } from './types.ts';
import { keplerPositionAtTime, keplerStateAtTime, stateToElements, computeOrbitalEllipse } from './kepler.ts';
import { integrateShipStep } from './physics.ts';
import { processCommand } from './commands.ts';
import { buildSOITable, determineSOIParent, getMuForBody } from './soi.ts';
import type { SOIEntry } from './soi.ts';
import {
  G,
  STAR_MU,
  STAR_MASS,
  MAX_SUBSTEP_DT,
  SHIP_MAX_ACCELERATION,
  SHIP_FUEL_CAPACITY,
  SHIP_FUEL_CONSUMPTION_RATE,
  PREDICTION_STEPS,
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
  // Star — real Sun
  const sol: CelestialBody = {
    id: 'sol', name: 'Sol', type: 'star',
    mass: STAR_MASS, radius: 6.96e8, color: 0xffdd44,
    elements: null, parentId: null,
  };

  // Planets — real orbital parameters
  // Tellus (Earth): a=1.496e11m, T≈365.25d, v_orb≈29.8 km/s
  const tellus = makeBody('tellus', 'Tellus', 'planet', 5.972e24, 6.371e6, 0x4488ff,
    'sol', 1.496e11, 0.017, 1.796, 0, STAR_MU);

  // Mara (Mars): a=2.279e11m, T≈687d
  const mara = makeBody('mara', 'Mara', 'planet', 6.39e23, 3.39e6, 0xcc6644,
    'sol', 2.279e11, 0.093, 5.0, 2.0, STAR_MU);

  // Jove (Jupiter): a=7.785e11m, T≈4333d
  const jove = makeBody('jove', 'Jove', 'planet', 1.898e27, 6.99e7, 0xddaa66,
    'sol', 7.785e11, 0.049, 4.8, 4.0, STAR_MU);

  // Moons of Jove — real Jupiter mu
  const joveMu = G * 1.898e27; // ≈1.267e17
  // Europa: a=6.709e8m, T≈3.55d
  const europa = makeBody('europa', 'Europa', 'moon', 4.8e22, 1.56e6, 0xaaccff,
    'jove', 6.709e8, 0.009, 0, 0, joveMu);
  // Ganymede: a=1.0704e9m, T≈7.15d
  const ganymede = makeBody('ganymede', 'Ganymede', 'moon', 1.48e23, 2.63e6, 0xccbbaa,
    'jove', 1.0704e9, 0.0013, 1.0, 1.5, joveMu);

  // Asteroids in the belt (~2.2–3.3 AU)
  const asteroids: CelestialBody[] = [];
  const rng = seedRng(42);
  for (let i = 0; i < 15; i++) {
    const a = 3.3e11 + rng() * 1.6e11; // 2.2–3.3 AU
    asteroids.push(makeBody(
      `asteroid_${i}`, `AST-${i + 1}`, 'asteroid', 1e15, 5e4, 0x888888,
      'sol', a, 0.01 + rng() * 0.15, rng() * Math.PI * 2, rng() * Math.PI * 2, STAR_MU,
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

  // Offset ship slightly from Tellus (~1 million km higher orbit)
  const shipA = tellusElements.a + 1e9;
  const shipElements = { ...tellusElements, a: shipA };
  const shipState = keplerStateAtTime(shipElements, gameTime);

  // Compute proper coast orbit from state vectors
  const coastOrbit = stateToElements(shipState.pos, shipState.vel, STAR_MU, gameTime);

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
    coastOrbit,
    parentBodyId: 'sol',
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
  // Cached body velocities for SOI-relevant bodies (planets + moons)
  bodyVelocities: Map<string, Vec2> = new Map();
  // Precomputed SOI table
  soiTable: SOIEntry[];

  constructor() {
    this.bodies = createBodies();
    this.gameTime = 0;
    this.paused = false;
    this.timeCompression = 10000;
    this.soiTable = buildSOITable(this.bodies);
    this.ships = [createPlayerShip(this.bodies, this.gameTime)];

    // Initialize positions and velocities
    this.updateBodyPositions();
  }

  /** Get the global position of a body (Vec2Zero for sol). */
  getBodyPosition(bodyId: string): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    return this.bodyPositions.get(bodyId) ?? Vec2Zero;
  }

  /** Get the global velocity of a body (Vec2Zero for sol). */
  getBodyVelocity(bodyId: string): Vec2 {
    if (bodyId === 'sol') return Vec2Zero;
    return this.bodyVelocities.get(bodyId) ?? Vec2Zero;
  }

  private updateBodyPositions(): void {
    // Set of body IDs that need velocity (SOI-relevant bodies)
    const soiBodyIds = new Set(this.soiTable.map(e => e.bodyId));

    for (const body of this.bodies) {
      if (body.elements === null) {
        // Star at origin
        this.bodyPositions.set(body.id, Vec2Zero);
      } else if (body.parentId && body.parentId !== 'sol') {
        // Moon: compute position relative to parent, then add parent position
        const parentPos = this.bodyPositions.get(body.parentId) ?? Vec2Zero;

        if (soiBodyIds.has(body.id)) {
          // Need velocity too — use keplerStateAtTime
          const localState = keplerStateAtTime(body.elements, this.gameTime);
          this.bodyPositions.set(body.id, vec2Add(parentPos, localState.pos));
          // Moon velocity = parent velocity + local orbital velocity
          const parentVel = this.bodyVelocities.get(body.parentId) ?? Vec2Zero;
          this.bodyVelocities.set(body.id, vec2Add(parentVel, localState.vel));
        } else {
          const localPos = keplerPositionAtTime(body.elements, this.gameTime);
          this.bodyPositions.set(body.id, vec2(
            parentPos.x + localPos.x,
            parentPos.y + localPos.y,
          ));
        }
      } else {
        // Planet/asteroid orbiting sol
        if (soiBodyIds.has(body.id)) {
          const state = keplerStateAtTime(body.elements, this.gameTime);
          this.bodyPositions.set(body.id, state.pos);
          this.bodyVelocities.set(body.id, state.vel);
        } else {
          this.bodyPositions.set(body.id, keplerPositionAtTime(body.elements, this.gameTime));
        }
      }
    }
  }

  /** Check if ship should transition to a different SOI parent. If so, recompute coastOrbit. */
  private checkSOITransition(ship: ShipState): void {
    const newParent = determineSOIParent(
      ship.position, ship.parentBodyId, this.soiTable, this.bodyPositions,
    );

    if (newParent === ship.parentBodyId) return;

    const oldParent = ship.parentBodyId;
    ship.parentBodyId = newParent;

    // Recompute coast orbit in new parent's frame if coasting
    if (ship.coastOrbit && !ship.isThrusting) {
      const parentPos = this.getBodyPosition(newParent);
      const parentVel = this.getBodyVelocity(newParent);
      const localPos = vec2Sub(ship.position, parentPos);
      const localVel = vec2Sub(ship.velocity, parentVel);
      const mu = getMuForBody(newParent, this.soiTable, STAR_MU);
      ship.coastOrbit = stateToElements(localPos, localVel, mu, this.gameTime);
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
          const mu = getMuForBody(ship.parentBodyId, this.soiTable, STAR_MU);
          const parentPos = this.getBodyPosition(ship.parentBodyId);
          integrateShipStep(ship, step, mu, parentPos);
        } else if (ship.coastOrbit) {
          // Coast orbit is in the parent body's local frame
          const localState = keplerStateAtTime(ship.coastOrbit, this.gameTime);
          const parentPos = this.getBodyPosition(ship.parentBodyId);
          const parentVel = this.getBodyVelocity(ship.parentBodyId);
          ship.position = vec2Add(parentPos, localState.pos);
          ship.velocity = vec2Add(parentVel, localState.vel);
        }

        // Check SOI transitions
        this.checkSOITransition(ship);
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
        parentBodyId: s.parentBodyId,
      })),
    };
  }

  /** Predict trajectory: Keplerian coast orbit relative to current SOI parent */
  predictTrajectory(shipId: string): Vec2[] {
    const ship = this.ships.find(s => s.id === shipId);
    if (!ship) return [];

    // Compute body-relative state vectors
    const parentPos = this.getBodyPosition(ship.parentBodyId);
    const parentVel = this.getBodyVelocity(ship.parentBodyId);
    const localPos = vec2Sub(ship.position, parentPos);
    const localVel = vec2Sub(ship.velocity, parentVel);
    const mu = getMuForBody(ship.parentBodyId, this.soiTable, STAR_MU);

    // Compute orbital elements in parent's frame
    const elements = stateToElements(localPos, localVel, mu, this.gameTime);

    // Generate local orbital ellipse, then offset by parent's global position
    const localPoints = computeOrbitalEllipse(elements, PREDICTION_STEPS);
    return localPoints.map(p => vec2Add(p, parentPos));
  }
}

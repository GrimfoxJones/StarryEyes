import type { CelestialBody, ShipState, Vec2 } from './types.js';
import { vec2, vec2Add, Vec2Zero } from './types.js';
import { keplerPositionAtTime } from './kepler.js';
import {
  STAR_MU,
  STAR_MASS,
  SHIP_MAX_ACCELERATION,
  SHIP_FUEL_CAPACITY,
  SHIP_FUEL_CONSUMPTION_RATE,
  ORBIT_VISUAL_RADIUS,
  G,
} from './constants.js';

// ── Helpers ─────────────────────────────────────────────────────────

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

function seedRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Body definitions ────────────────────────────────────────────────

export function createDefaultBodies(): CelestialBody[] {
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

  // Tellus moons & station
  const tellusMu = G * 5.972e24;
  const luna = makeBody('luna', 'Luna', 'moon', 7.34e22, 1.74e6, 0xcccccc,
    'tellus', 5.766e8, 0.055, 0, 0, tellusMu);
  const nyx = makeBody('nyx', 'Nyx', 'moon', 1.1e20, 2.5e5, 0x9988aa,
    'tellus', 1.1532e9, 0.02, 2.0, 3.5, tellusMu);
  const tycho = makeBody('tycho', 'Tycho Station', 'station', 5e9, 5e4, 0x44ffcc,
    'tellus', 1.922e9, 0.001, 0.5, 1.0, tellusMu);

  // Jove moons
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

  return [sol, tellus, luna, nyx, tycho, mara, jove, europa, ganymede, ...asteroids];
}

// ── Ship initialization ─────────────────────────────────────────────

/** Compute the global position of a body at a given time. */
function bodyPositionAtTime(bodies: readonly CelestialBody[], bodyId: string, t: number): Vec2 {
  if (bodyId === 'sol') return Vec2Zero;
  const body = bodies.find(b => b.id === bodyId);
  if (!body || !body.elements) return Vec2Zero;

  if (body.parentId && body.parentId !== 'sol') {
    const parentPos = bodyPositionAtTime(bodies, body.parentId, t);
    const localPos = keplerPositionAtTime(body.elements, t);
    return vec2Add(parentPos, localPos);
  }

  return keplerPositionAtTime(body.elements, t);
}

export function createPlayerShip(bodies: readonly CelestialBody[], gameTime: number, shipId = 'player'): ShipState {
  const tellusPos = bodyPositionAtTime(bodies, 'tellus', gameTime);

  return {
    id: shipId,
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

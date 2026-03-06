import type { CelestialBody, ShipState, Vec2 } from './types.js';
import { DARTER_MASS } from './ships/darter.js';
import { vec2, vec2Add, Vec2Zero } from './types.js';
import { keplerPositionAtTime } from './kepler.js';
import {
  STAR_MU,
  STAR_MASS,
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

  // Captured asteroids orbiting Tellus
  const cruithne = makeBody('cruithne', 'Cruithne', 'asteroid', 1.3e14, 2.5e4, 0x888888,
    'tellus', 2.5e9, 0.35, 0.8, 4.2, tellusMu);
  const kamo = makeBody('kamo', 'Kamo\'oalewa', 'asteroid', 5e13, 2e4, 0x999988,
    'tellus', 3.2e9, 0.45, 3.5, 1.8, tellusMu);

  // Mara moon & captured asteroids
  const maraMu = G * 6.39e23;
  const deimos = makeBody('deimos', 'Deimos', 'moon', 1.48e15, 6.2e3, 0xbb9977,
    'mara', 6.0e8, 0.03, 1.2, 0.5, maraMu);
  const maraRock1 = makeBody('mara_rock_1', 'MR-1', 'asteroid', 8e12, 1.5e4, 0x887766,
    'mara', 1.4e9, 0.3, 4.1, 2.7, maraMu);
  const maraRock2 = makeBody('mara_rock_2', 'MR-2', 'asteroid', 3e12, 1e4, 0x998877,
    'mara', 2.1e9, 0.4, 1.9, 5.0, maraMu);

  // Jove moons
  const joveMu = G * 1.898e27;
  const europa = makeBody('europa', 'Europa', 'moon', 4.8e22, 1.56e6, 0xaaccff,
    'jove', 6.709e8, 0.009, 0, 0, joveMu);
  const ganymede = makeBody('ganymede', 'Ganymede', 'moon', 1.48e23, 2.63e6, 0xccbbaa,
    'jove', 1.0704e9, 0.0013, 1.0, 1.5, joveMu);
  const callisto = makeBody('callisto', 'Callisto', 'moon', 1.08e23, 2.41e6, 0x998866,
    'jove', 1.883e9, 0.007, 2.3, 0.8, joveMu);
  const io = makeBody('io', 'Io', 'moon', 8.93e22, 1.82e6, 0xddcc44,
    'jove', 2.8e9, 0.004, 4.5, 3.2, joveMu);
  const thebe = makeBody('thebe', 'Thebe', 'moon', 4.3e19, 5e5, 0xaa9988,
    'jove', 3.6e9, 0.02, 0.7, 5.1, joveMu);
  const himalia = makeBody('himalia', 'Himalia', 'moon', 6.7e18, 8.5e4, 0xbbaa99,
    'jove', 5.0e9, 0.05, 3.0, 1.4, joveMu);
  const elara = makeBody('elara', 'Elara', 'moon', 8.7e17, 4.3e4, 0xccbb88,
    'jove', 6.5e9, 0.08, 5.5, 4.0, joveMu);
  const pasiphae = makeBody('pasiphae', 'Pasiphae', 'moon', 3.0e17, 3e4, 0xaa8877,
    'jove', 8.2e9, 0.12, 1.5, 2.6, joveMu);

  // Jove captured asteroids
  const joveRock1 = makeBody('jove_rock_1', 'JR-1', 'asteroid', 5e13, 2e4, 0x887766,
    'jove', 1.0e10, 0.25, 2.2, 0.3, joveMu);
  const joveRock2 = makeBody('jove_rock_2', 'JR-2', 'asteroid', 3e13, 1.5e4, 0x776655,
    'jove', 1.3e10, 0.35, 5.0, 3.8, joveMu);
  const joveRock3 = makeBody('jove_rock_3', 'JR-3', 'asteroid', 2e13, 1.2e4, 0x998877,
    'jove', 1.6e10, 0.4, 0.4, 5.5, joveMu);
  const joveRock4 = makeBody('jove_rock_4', 'JR-4', 'asteroid', 1e13, 1e4, 0x665544,
    'jove', 2.0e10, 0.45, 3.7, 1.1, joveMu);

  const asteroids: CelestialBody[] = [];
  const rng = seedRng(42);
  for (let i = 0; i < 15; i++) {
    const a = 3.3e11 + rng() * 1.6e11;
    asteroids.push(makeBody(
      `asteroid_${i}`, `AST-${i + 1}`, 'asteroid', 1e15, 5e4, 0x888888,
      'sol', a, 0.01 + rng() * 0.15, rng() * Math.PI * 2, rng() * Math.PI * 2, STAR_MU,
    ));
  }

  return [sol, tellus, luna, nyx, tycho, cruithne, kamo, mara, deimos, maraRock1, maraRock2, jove, europa, ganymede, callisto, io, thebe, himalia, elara, pasiphae, joveRock1, joveRock2, joveRock3, joveRock4, ...asteroids];
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
    maxAcceleration: DARTER_MASS.maxAcceleration,
    fuel: DARTER_MASS.maxPropellant,
    fuelConsumptionRate: DARTER_MASS.fuelConsumptionRate,
    mode: 'orbit',
    route: null,
    orbitBodyId: 'tellus',
    orbitAngle: 0,
  };
}

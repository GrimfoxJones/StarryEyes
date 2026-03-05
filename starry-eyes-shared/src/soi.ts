import type { CelestialBody, Vec2 } from './types.js';
import { vec2Dist } from './types.js';
import { G } from './constants.js';

// ── SOI Entry ────────────────────────────────────────────────────────

export interface SOIEntry {
  readonly bodyId: string;
  readonly parentId: string;       // immediate parent ('sol' for planets, planet id for moons)
  readonly mu: number;             // G * mass of this body
  readonly soiRadius: number;      // sphere of influence radius (m)
  readonly body: CelestialBody;
}

// ── Build SOI Table ──────────────────────────────────────────────────

/** Precompute SOI data for all relevant bodies. Moons come before planets
 *  so determineSOIParent checks innermost bodies first. */
export function buildSOITable(bodies: CelestialBody[]): SOIEntry[] {
  const table: SOIEntry[] = [];
  const bodyMap = new Map(bodies.map(b => [b.id, b]));

  // Collect planets and moons (skip star and asteroids)
  const planets: CelestialBody[] = [];
  const moons: CelestialBody[] = [];

  for (const body of bodies) {
    if (body.type === 'planet') planets.push(body);
    else if (body.type === 'moon') moons.push(body);
  }

  // Compute SOI for planets (parent = star)
  for (const planet of planets) {
    if (!planet.elements) continue;
    const starBody = bodyMap.get(planet.parentId!);
    if (!starBody) continue;

    const soiRadius = planet.elements.a * Math.pow(planet.mass / starBody.mass, 2 / 5);
    table.push({
      bodyId: planet.id,
      parentId: planet.parentId!,
      mu: G * planet.mass,
      soiRadius,
      body: planet,
    });
  }

  // Compute SOI for moons (parent = planet)
  for (const moon of moons) {
    if (!moon.elements) continue;
    const parentBody = bodyMap.get(moon.parentId!);
    if (!parentBody) continue;

    const soiRadius = moon.elements.a * Math.pow(moon.mass / parentBody.mass, 2 / 5);
    table.push({
      bodyId: moon.id,
      parentId: moon.parentId!,
      mu: G * moon.mass,
      soiRadius,
      body: moon,
    });
  }

  // Sort: moons first (smallest SOI), then planets — ensures innermost checked first
  table.sort((a, b) => a.soiRadius - b.soiRadius);

  return table;
}

// ── Determine SOI Parent ─────────────────────────────────────────────

const SOI_EXIT_HYSTERESIS = 1.05; // exit at 105% of SOI radius

/** Determine which body's SOI the ship is inside. Returns 'sol' if outside all SOIs.
 *  Uses 5% hysteresis: enter at 1.0x, exit at 1.05x to prevent oscillation. */
export function determineSOIParent(
  shipPos: Vec2,
  currentParentId: string,
  soiTable: readonly SOIEntry[],
  bodyPositions: Map<string, Vec2>,
): string {
  // Check all SOI bodies from innermost (moons) to outermost (planets)
  for (const entry of soiTable) {
    const bodyPos = bodyPositions.get(entry.bodyId);
    if (!bodyPos) continue;

    const dist = vec2Dist(shipPos, bodyPos);
    const isCurrentParent = entry.bodyId === currentParentId;

    // Hysteresis: wider threshold for exit
    const threshold = isCurrentParent
      ? entry.soiRadius * SOI_EXIT_HYSTERESIS
      : entry.soiRadius;

    if (dist < threshold) {
      return entry.bodyId;
    }
  }

  return 'sol';
}

// ── Lookup helpers ───────────────────────────────────────────────────

/** Get the gravitational parameter (mu) for a given parent body. */
export function getMuForBody(bodyId: string, soiTable: readonly SOIEntry[], starMu: number): number {
  if (bodyId === 'sol') return starMu;
  const entry = soiTable.find(e => e.bodyId === bodyId);
  return entry ? entry.mu : starMu;
}

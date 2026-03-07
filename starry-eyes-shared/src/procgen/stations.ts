import type { SeededRng } from './rng.js';
import type {
  GeneratedSystem, StationData, SystemSettlement,
  ResourceLevel, PlanetResources, SettlementLevel, StationKind,
  SettledBodyData,
} from './types.js';
import type { StationArchetype } from '../economy/types.js';
import { STATION_ARCHETYPE_DEFS } from '../economy/commodities.js';

const RESOURCE_LEVELS: Record<ResourceLevel, number> = {
  none: 0, trace: 0.1, poor: 0.3, moderate: 0.6, rich: 0.85, exceptional: 1.0,
};

// ── Station count by settlement level ────────────────────────────────

const STATION_COUNTS: Record<SettlementLevel, [number, number]> = {
  unexplored: [0, 0],
  surveyed:   [1, 1],
  outpost:    [2, 3],
  settled:    [3, 5],
  developed:  [4, 7],
  prime:      [6, 9],
};

// ── Body info for station assignment ─────────────────────────────────

interface CandidateBody {
  id: string;
  name: string;
  resources: PlanetResources;
  semiMajorAxis: number;
  mass: number;
  kind: StationKind;
  atmosphere?: { breathable: boolean };
  surfaceGravity: number;  // m/s²
  isSettled: boolean;
}

const EARTH_G = 9.80665;

/** Gravity penalty for non-settled orbital bodies: no penalty ≤1.5g, linear decay to 0 at 4g */
function gravityPenalty(surfaceGravityMs2: number): number {
  const g = surfaceGravityMs2 / EARTH_G;
  if (g <= 1.5) return 1.0;
  return Math.max(0, 1 - (g - 1.5) / 2.5);
}

function gatherCandidates(system: GeneratedSystem, settledBodies: Record<string, SettledBodyData>): CandidateBody[] {
  const candidates: CandidateBody[] = [];

  for (const planet of system.planets) {
    // Skip settled bodies — they already have guaranteed stations
    if (!settledBodies[planet.id]) {
      candidates.push({
        id: planet.id,
        name: planet.name,
        resources: planet.resources,
        semiMajorAxis: planet.semiMajorAxis,
        mass: planet.physical.mass,
        kind: 'orbital',
        atmosphere: planet.atmosphere,
        surfaceGravity: planet.physical.surfaceGravity,
        isSettled: false,
      });
    }
    for (const moon of planet.moons) {
      if (settledBodies[moon.id]) continue;
      const isLarge = moon.physical.mass > 1e21;
      candidates.push({
        id: moon.id,
        name: moon.name,
        resources: moon.resources,
        semiMajorAxis: moon.semiMajorAxis,
        mass: moon.physical.mass,
        kind: isLarge ? 'orbital' : 'ground',
        atmosphere: moon.atmosphere,
        surfaceGravity: moon.physical.surfaceGravity,
        isSettled: false,
      });
    }
  }

  for (const asteroid of system.asteroids) {
    candidates.push({
      id: asteroid.id,
      name: asteroid.name,
      resources: asteroid.resources,
      semiMajorAxis: asteroid.semiMajorAxis,
      mass: asteroid.mass,
      kind: 'ground',
      surfaceGravity: 0, // negligible for asteroids
      isSettled: false,
    });
  }

  return candidates;
}

function resourceScore(resources: PlanetResources, ...keys: (keyof PlanetResources)[]): number {
  return keys.reduce((sum, k) => sum + RESOURCE_LEVELS[resources[k] ?? 'none'], 0);
}

function bestBodyFor(
  candidates: CandidateBody[],
  scorer: (b: CandidateBody) => number,
  usedBodyIds: Set<string>,
): CandidateBody | null {
  let best: CandidateBody | null = null;
  let bestScore = -1;
  for (const b of candidates) {
    if (usedBodyIds.has(b.id)) continue;
    const s = scorer(b);
    if (s > bestScore) {
      bestScore = s;
      best = b;
    }
  }
  return best;
}

// ── Archetype selection pool by settlement level ─────────────────────

function archetypePool(level: SettlementLevel): StationArchetype[] {
  switch (level) {
    case 'unexplored': return [];
    case 'surveyed':   return ['mining_outpost'];
    case 'outpost':    return ['mining_outpost', 'water_depot', 'mining_outpost'];
    case 'settled':    return ['mining_outpost', 'water_depot', 'habitat_colony', 'mining_outpost', 'shipyard'];
    case 'developed':  return ['mining_outpost', 'water_depot', 'habitat_colony', 'shipyard', 'military_base', 'weapon_factory', 'mining_outpost'];
    case 'prime':      return ['mining_outpost', 'water_depot', 'habitat_colony', 'shipyard', 'military_base', 'weapon_factory', 'habitat_colony', 'mining_outpost', 'water_depot'];
  }
}

// ── Main generation function ─────────────────────────────────────────

export function generateStations(
  rng: SeededRng,
  system: GeneratedSystem,
  settlement: SystemSettlement,
  settledBodies: Record<string, SettledBodyData> = {},
): Record<string, StationData> {
  const stations: Record<string, StationData> = {};
  const usedBodyIds = new Set<string>();

  // Phase 1: Guaranteed orbital stations for settled bodies
  for (const [bodyId, settled] of Object.entries(settledBodies)) {
    // Find the body name
    let bodyName = bodyId;
    for (const planet of system.planets) {
      if (planet.id === bodyId) { bodyName = planet.name; break; }
      for (const moon of planet.moons) {
        if (moon.id === bodyId) { bodyName = moon.name; break; }
      }
    }

    const orbitalPop = Math.round(settled.surfacePopulation * 0.05);
    const archetypeDef = STATION_ARCHETYPE_DEFS['habitat_colony'];

    stations[bodyId] = {
      name: `${bodyName} Orbital Station`,
      archetype: 'habitat_colony',
      kind: 'orbital',
      initialPopulation: Math.max(archetypeDef.basePopulation, orbitalPop),
      surfacePopulation: settled.surfacePopulation,
    };
    usedBodyIds.add(bodyId);
  }

  // Phase 2: Normal station pool (existing logic)
  const [minCount, maxCount] = STATION_COUNTS[settlement.settlementLevel];
  if (maxCount === 0) return stations;

  const count = minCount + Math.floor(rng.next() * (maxCount - minCount + 1));
  const pool = archetypePool(settlement.settlementLevel);
  const candidates = gatherCandidates(system, settledBodies);
  if (candidates.length === 0) return stations;

  for (let i = 0; i < count && i < pool.length; i++) {
    const archetype = pool[i];
    const archetypeDef = STATION_ARCHETYPE_DEFS[archetype];
    const body = pickBody(archetype, candidates, usedBodyIds, system);
    if (!body) continue;

    usedBodyIds.add(body.id);

    const kindLabel = body.kind === 'orbital' ? 'Station' : 'Base';
    const stationName = `${body.name} ${archetypeDef.name.replace('Outpost', kindLabel).replace('Colony', kindLabel).replace('Depot', kindLabel).replace('Base', kindLabel).replace('Factory', kindLabel).replace('Shipyard', kindLabel)}`;

    stations[body.id] = {
      name: stationName,
      archetype,
      kind: body.kind,
      initialPopulation: archetypeDef.basePopulation,
    };
  }

  return stations;
}

function pickBody(
  archetype: StationArchetype,
  candidates: CandidateBody[],
  usedBodyIds: Set<string>,
  system: GeneratedSystem,
): CandidateBody | null {
  // Wrap scorers with gravity penalty for orbital candidates
  const withGravity = (scorer: (b: CandidateBody) => number) => {
    return (b: CandidateBody) => {
      const base = scorer(b);
      if (b.kind === 'orbital') return base * gravityPenalty(b.surfaceGravity);
      return base;
    };
  };

  switch (archetype) {
    case 'mining_outpost':
      return bestBodyFor(candidates, withGravity(b => resourceScore(b.resources, 'commonMetals', 'rareMetals')), usedBodyIds);

    case 'water_depot':
      return bestBodyFor(candidates, withGravity(b => resourceScore(b.resources, 'waterAvailability')), usedBodyIds);

    case 'habitat_colony':
      return bestBodyFor(candidates, withGravity(b => {
        let score = 0;
        if (b.atmosphere?.breathable) score += 2;
        const dist = b.semiMajorAxis;
        if (dist >= system.habitableZone.inner && dist <= system.habitableZone.outer) score += 1.5;
        score += resourceScore(b.resources, 'waterAvailability') * 0.5;
        return score;
      }), usedBodyIds);

    case 'shipyard':
    case 'weapon_factory':
    case 'military_base':
      return bestBodyFor(candidates, withGravity(b => Math.log10(Math.max(b.mass, 1))), usedBodyIds);

    default:
      return candidates.find(b => !usedBodyIds.has(b.id)) ?? null;
  }
}

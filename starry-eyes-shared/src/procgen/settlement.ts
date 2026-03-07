import type {
  GeneratedSystem, GeneratedPlanet, GeneratedMoon,
  SettlementLevel, SystemSettlement, ResourceLevel, PlanetResources,
  SettledBodyData, BiosphereComplexity,
} from './types.js';

// ── Resource level numeric mapping ──────────────────────────────────

const RESOURCE_LEVELS: Record<ResourceLevel, number> = {
  none: 0, trace: 0.1, poor: 0.3, moderate: 0.6, rich: 0.85, exceptional: 1.0,
};

// Active resources wired to Phase 3 commodities
const ACTIVE_RESOURCES: (keyof PlanetResources)[] = [
  'waterAvailability',
  'commonMetals',
  'rareMetals',
  'silicates',
  'carbon',
];

// ── Helpers ─────────────────────────────────────────────────────────

interface ResourcedBody {
  resources: PlanetResources;
  atmosphere?: { breathable: boolean };
  surface?: { surfaceType: string } | null;
  biosphere?: { complexity: string };
}

function allBodies(system: GeneratedSystem): ResourcedBody[] {
  const bodies: ResourcedBody[] = [...system.planets, ...system.asteroids];
  for (const planet of system.planets) {
    for (const moon of planet.moons) {
      bodies.push(moon);
    }
  }
  return bodies;
}

// ── Step 1: Remoteness Score ────────────────────────────────────────

function remotenessScore(systemId: number): number {
  const k = 0.003;
  return 1 - Math.exp(-k * systemId);
}

// ── Step 2: Resource Diversity Score ────────────────────────────────

function resourceDiversityScore(system: GeneratedSystem): number {
  const systemTotals: Partial<Record<keyof PlanetResources, number>> = {};

  for (const body of allBodies(system)) {
    for (const resource of ACTIVE_RESOURCES) {
      const level = RESOURCE_LEVELS[body.resources[resource] ?? 'none'];
      systemTotals[resource] = Math.max(systemTotals[resource] ?? 0, level);
    }
  }

  const raw = ACTIVE_RESOURCES.reduce((sum, r) => {
    return sum + Math.sqrt(systemTotals[r] ?? 0);
  }, 0);

  return raw / ACTIVE_RESOURCES.length;
}

// ── Step 3: Habitability Bonus ──────────────────────────────────────

function habitabilityBonus(system: GeneratedSystem): number {
  let bonus = 0;

  const bodies: (GeneratedPlanet | GeneratedMoon)[] = [...system.planets];
  for (const planet of system.planets) {
    for (const moon of planet.moons) {
      bodies.push(moon);
    }
  }

  for (const body of bodies) {
    if (body.atmosphere?.breathable) {
      bonus += 0.4;

      if (body.surface?.surfaceType === 'oceanic' || body.surface?.surfaceType === 'terrestrial') {
        bonus += 0.2;
      }

      const complexity = body.biosphere?.complexity;
      if (complexity === 'complex_multicellular') bonus += 0.2;
      else if (complexity === 'simple_multicellular') bonus += 0.1;
    }
  }

  return Math.min(bonus, 1.0);
}

// ── Step 4: Combined Settlement Score ───────────────────────────────

function settlementScore(system: GeneratedSystem, systemId: number): {
  score: number;
  remoteness: number;
  resourceDiversity: number;
  habitability: number;
} {
  const remoteness = remotenessScore(systemId);
  const resourceDiversity = resourceDiversityScore(system);
  const habitability = habitabilityBonus(system);

  const baseScore = (resourceDiversity * 0.5) + (habitability * 0.5);
  const score = baseScore * (1 - remoteness * 0.8);

  return { score, remoteness, resourceDiversity, habitability };
}

// ── Step 5: Settlement Level ────────────────────────────────────────

function levelFromScore(score: number): SettlementLevel {
  if (score >= 0.80) return 'prime';
  if (score >= 0.60) return 'developed';
  if (score >= 0.40) return 'settled';
  if (score >= 0.20) return 'outpost';
  if (score >= 0.05) return 'surveyed';
  return 'unexplored';
}

// ── Public API ──────────────────────────────────────────────────────

export function computeSettlement(system: GeneratedSystem, systemId: number): SystemSettlement {
  const { score, remoteness, resourceDiversity, habitability } = settlementScore(system, systemId);

  return {
    settlementLevel: levelFromScore(score),
    score,
    remoteness,
    resourceDiversity,
    habitability,
  };
}

// ── Initial Economic State ──────────────────────────────────────────

const INITIAL_STOCKPILE_FRACTIONS: Partial<Record<SettlementLevel, number>> = {
  surveyed:  0.2,
  outpost:   0.4,
  settled:   0.6,
  developed: 0.75,
  prime:     0.9,
};

export function initialStockpileFraction(level: SettlementLevel): number {
  return INITIAL_STOCKPILE_FRACTIONS[level] ?? 0;
}

// ── Settled Bodies ──────────────────────────────────────────────────

const EARTH_G = 9.80665;
const MIN_GRAVITY_G = 0.2;
const MAX_GRAVITY_G = 1.5;
const MIN_MOON_MASS = 1e21; // kg — only large moons qualify

const BIOSPHERE_SCORES: Record<BiosphereComplexity, number> = {
  none: 0,
  prebiotic: 0.02,
  microbial: 0.05,
  simple_multicellular: 0.08,
  complex_multicellular: 0.12,
  intelligent: 0.15,
};

function computeHabitabilityScore(body: GeneratedPlanet | GeneratedMoon): number {
  const g = body.physical.surfaceGravity / EARTH_G;

  // Gravity (25%): bell curve peaking at 1.0g
  const gravityScore = Math.max(0, 1 - ((g - 1) / 0.5) ** 2);

  // Breathable atmosphere (35%): binary
  const breathableScore = body.atmosphere.breathable ? 1 : 0;

  // Temperature (15%): deviation from 288K
  const tempScore = Math.max(0, 1 - Math.abs(body.physical.surfaceTemperature - 288) / 100);

  // Water (10%): surface liquid water coverage, ideal ~70%
  let waterScore = 0;
  if (body.surface?.surfaceLiquid?.type === 'water') {
    const coverage = body.surface.surfaceLiquid.coverage;
    waterScore = 1 - Math.abs(coverage - 0.7) / 0.7;
    waterScore = Math.max(0, waterScore);
  }

  // Biosphere (15%): complexity scale
  const bioScore = BIOSPHERE_SCORES[body.biosphere.complexity] / 0.15; // normalize to 0-1

  return (
    gravityScore * 0.25 +
    breathableScore * 0.35 +
    tempScore * 0.15 +
    waterScore * 0.10 +
    bioScore * 0.15
  );
}

function computeSurfacePopulation(habitabilityScore: number, breathable: boolean): number {
  if (breathable) {
    // 50,000 to 50,000,000 — exponential scaling
    const minPop = 50_000;
    const maxPop = 50_000_000;
    return Math.round(minPop * Math.pow(maxPop / minPop, habitabilityScore));
  } else {
    // 2,000 to 15,000 — linear scaling (dome colonies)
    return Math.round(2_000 + 13_000 * habitabilityScore);
  }
}

export function computeSettledBodies(system: GeneratedSystem): Record<string, SettledBodyData> {
  const settled: Record<string, SettledBodyData> = {};

  const candidates: (GeneratedPlanet | GeneratedMoon)[] = [...system.planets];
  for (const planet of system.planets) {
    for (const moon of planet.moons) {
      if (moon.physical.mass >= MIN_MOON_MASS) {
        candidates.push(moon);
      }
    }
  }

  for (const body of candidates) {
    const g = body.physical.surfaceGravity / EARTH_G;
    if (g < MIN_GRAVITY_G || g > MAX_GRAVITY_G) continue;
    if (!body.surface) continue; // must have solid surface

    const habitabilityScore = computeHabitabilityScore(body);
    const surfacePopulation = computeSurfacePopulation(habitabilityScore, body.atmosphere.breathable);

    settled[body.id] = {
      bodyId: body.id,
      surfaceGravityG: g,
      surfacePopulation,
      habitabilityScore,
    };
  }

  return settled;
}

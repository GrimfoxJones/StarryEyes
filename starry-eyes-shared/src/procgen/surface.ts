import type { SeededRng } from './rng.js';
import type {
  PlanetClass, OrbitalZone, PlanetSurface, PlanetInterior,
  SurfaceType, VolcanismLevel, SurfaceLiquid, MaterialFraction,
  CoreType, PlanetPhysicalParams, PlanetAtmosphere,
} from './types.js';

// ── Surface generation ───────────────────────────────────────────────

export function generateSurface(
  rng: SeededRng,
  planetClass: PlanetClass,
  physical: PlanetPhysicalParams,
  atmosphere: PlanetAtmosphere,
  zone: OrbitalZone,
): PlanetSurface {
  const tEq = physical.equilibriumTemperature;
  const hasAtmo = atmosphere.present;
  const pressure = atmosphere.surfacePressure;

  const surfaceType = determineSurfaceType(rng, tEq, hasAtmo, pressure, zone, planetClass);
  const tectonicallyActive = planetClass !== 'dwarf' && rng.chance(0.4);
  const volcanism = determineVolcanism(rng, surfaceType, tectonicallyActive, tEq);
  const surfaceLiquid = determineSurfaceLiquid(rng, surfaceType, tEq);
  const crustComposition = crustForSurfaceType(surfaceType);
  const surfaceFeatures = generateFeatures(rng, surfaceType);

  return {
    hasSolidSurface: true,
    crustComposition,
    surfaceType,
    tectonicallyActive,
    volcanism,
    surfaceLiquid,
    surfacePressure: hasAtmo ? pressure * 101325 : 0,
    surfaceFeatures,
  };
}

function determineSurfaceType(
  rng: SeededRng,
  tEq: number,
  hasAtmo: boolean,
  pressure: number,
  zone: OrbitalZone,
  planetClass: PlanetClass,
): SurfaceType {
  if (tEq > 1500) return 'lava';
  if (tEq > 700 && hasAtmo && pressure > 10) return 'greenhouse';
  if (tEq > 700) return 'barren_rocky';

  if (zone === 'habitable' && hasAtmo) {
    if (planetClass === 'super_earth' && rng.chance(0.3)) return 'oceanic';
    if (rng.chance(0.4)) return 'terrestrial';
    if (rng.chance(0.4)) return 'desert';
    return 'oceanic';
  }

  if (tEq < 200 && hasAtmo) {
    return rng.chance(0.5) ? 'frozen' : 'ice_rock';
  }
  if (tEq < 200) return 'barren_rocky';

  // Carbon worlds (rare)
  if (rng.chance(0.03)) return 'carbon';

  // Volcanic if close to star with some atmosphere
  if (zone === 'hot' && rng.chance(0.2)) return 'volcanic';

  return rng.chance(0.5) ? 'desert' : 'barren_rocky';
}

function determineVolcanism(
  rng: SeededRng,
  surfaceType: SurfaceType,
  tectonicallyActive: boolean,
  tEq: number,
): VolcanismLevel {
  if (surfaceType === 'volcanic' || surfaceType === 'lava') return 'extreme';
  if (!tectonicallyActive) return rng.chance(0.3) ? 'extinct' : 'none';
  if (tEq > 400) return rng.chance(0.5) ? 'moderate' : 'minor';
  return rng.weighted(
    ['none', 'extinct', 'minor', 'moderate', 'extreme'] as VolcanismLevel[],
    [10, 20, 40, 25, 5],
  );
}

function determineSurfaceLiquid(
  rng: SeededRng,
  surfaceType: SurfaceType,
  tEq: number,
): SurfaceLiquid | null {
  switch (surfaceType) {
    case 'oceanic':
      return { type: 'water', coverage: rng.range(0.7, 1.0), depth: rng.pick(['moderate', 'deep', 'global_ocean']) };
    case 'terrestrial':
      return { type: 'water', coverage: rng.range(0.3, 0.8), depth: rng.pick(['shallow', 'moderate', 'deep']) };
    case 'lava':
      return { type: 'lava', coverage: rng.range(0.2, 0.8), depth: 'shallow' };
    case 'ice_rock':
      if (tEq > 80 && tEq < 120 && rng.chance(0.3)) {
        return { type: 'methane', coverage: rng.range(0.05, 0.3), depth: 'shallow' };
      }
      return null;
    default:
      return null;
  }
}

function crustForSurfaceType(surfaceType: SurfaceType): MaterialFraction[] {
  const CRUST_MAP: Record<SurfaceType, MaterialFraction[]> = {
    barren_rocky: [{ material: 'silicate', fraction: 0.60 }, { material: 'feldspar', fraction: 0.25 }, { material: 'iron_oxide', fraction: 0.10 }, { material: 'other', fraction: 0.05 }],
    volcanic:     [{ material: 'basalt', fraction: 0.50 }, { material: 'sulfur_compounds', fraction: 0.30 }, { material: 'silicate', fraction: 0.15 }, { material: 'iron', fraction: 0.05 }],
    frozen:       [{ material: 'water_ice', fraction: 0.70 }, { material: 'silicate', fraction: 0.15 }, { material: 'ammonia_ice', fraction: 0.10 }, { material: 'co2_ice', fraction: 0.05 }],
    desert:       [{ material: 'silicate', fraction: 0.55 }, { material: 'iron_oxide', fraction: 0.25 }, { material: 'feldspar', fraction: 0.15 }, { material: 'calcium_carbonate', fraction: 0.05 }],
    oceanic:      [{ material: 'basalt', fraction: 0.45 }, { material: 'silicate', fraction: 0.30 }, { material: 'sedimentary', fraction: 0.15 }, { material: 'metal', fraction: 0.10 }],
    terrestrial:  [{ material: 'silicate', fraction: 0.50 }, { material: 'feldspar', fraction: 0.20 }, { material: 'quartz', fraction: 0.15 }, { material: 'limestone', fraction: 0.10 }, { material: 'metal', fraction: 0.05 }],
    greenhouse:   [{ material: 'basalt', fraction: 0.40 }, { material: 'silicate', fraction: 0.30 }, { material: 'sulfur_compounds', fraction: 0.20 }, { material: 'iron_oxide', fraction: 0.10 }],
    carbon:       [{ material: 'graphite', fraction: 0.50 }, { material: 'silicon_carbide', fraction: 0.25 }, { material: 'diamond', fraction: 0.15 }, { material: 'iron_carbide', fraction: 0.10 }],
    lava:         [{ material: 'basalt', fraction: 0.60 }, { material: 'silicate_slag', fraction: 0.25 }, { material: 'iron', fraction: 0.10 }, { material: 'crystallized_mineral', fraction: 0.05 }],
    ice_rock:     [{ material: 'water_ice', fraction: 0.40 }, { material: 'silicate', fraction: 0.25 }, { material: 'hydrocarbon', fraction: 0.20 }, { material: 'ammonia', fraction: 0.15 }],
  };
  return CRUST_MAP[surfaceType];
}

function generateFeatures(rng: SeededRng, surfaceType: SurfaceType): string[] {
  const features: string[] = [];
  const FEATURE_POOLS: Record<SurfaceType, string[]> = {
    barren_rocky: ['impact craters', 'dust plains', 'cliff faces', 'ancient basins'],
    volcanic:     ['lava flows', 'volcanic vents', 'sulfur lakes', 'obsidian fields'],
    frozen:       ['ice ridges', 'subsurface ocean', 'cryovolcanoes', 'frozen plains'],
    desert:       ['dune seas', 'canyon systems', 'dust storms', 'salt flats'],
    oceanic:      ['deep trenches', 'island chains', 'coral analogs', 'tidal flats'],
    terrestrial:  ['mountain ranges', 'river systems', 'continental shelves', 'forest zones'],
    greenhouse:   ['acid rain', 'volcanic plateaus', 'pressure ridges', 'cloud decks'],
    carbon:       ['diamond plains', 'tar lakes', 'graphite cliffs', 'methane geysers'],
    lava:         ['magma seas', 'crystal formations', 'volcanic peaks', 'heat vents'],
    ice_rock:     ['methane lakes', 'ice mountains', 'haze layers', 'cryogenic valleys'],
  };
  const pool = FEATURE_POOLS[surfaceType];
  const count = rng.int(1, 3);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const f = rng.pick(pool);
    if (!features.includes(f)) features.push(f);
  }
  return features;
}

// ── Interior generation ──────────────────────────────────────────────

export function generateInterior(
  rng: SeededRng,
  planetClass: PlanetClass,
  zone: OrbitalZone,
): PlanetInterior {
  const { coreType, coreComposition, mantleComposition, coreMassFraction } = interiorForClass(rng, planetClass, zone);

  return {
    coreType,
    coreComposition,
    mantleComposition,
    coreMassFraction,
    differentiated: planetClass !== 'dwarf' && rng.chance(0.8),
  };
}

function interiorForClass(
  rng: SeededRng,
  planetClass: PlanetClass,
  zone: OrbitalZone,
): { coreType: CoreType; coreComposition: MaterialFraction[]; mantleComposition: MaterialFraction[]; coreMassFraction: number } {
  switch (planetClass) {
    case 'rocky':
    case 'super_earth':
      return {
        coreType: zone === 'hot' ? 'iron_nickel' : (rng.chance(0.7) ? 'iron_nickel' : 'silicate'),
        coreComposition: [
          { material: 'iron', fraction: 0.65 + rng.range(-0.05, 0.05) },
          { material: 'nickel', fraction: 0.20 + rng.range(-0.05, 0.05) },
          { material: 'silicate', fraction: 0.10 },
          { material: 'sulfide', fraction: 0.05 },
        ],
        mantleComposition: [
          { material: 'silicate', fraction: 0.70 },
          { material: 'magnesium_oxide', fraction: 0.20 },
          { material: 'iron_oxide', fraction: 0.10 },
        ],
        coreMassFraction: rng.range(0.20, 0.45),
      };
    case 'mini_neptune':
      return {
        coreType: rng.chance(0.5) ? 'ice' : 'silicate',
        coreComposition: [
          { material: 'water_ice', fraction: 0.40 },
          { material: 'silicate', fraction: 0.30 },
          { material: 'iron', fraction: 0.20 },
          { material: 'ammonia', fraction: 0.10 },
        ],
        mantleComposition: [
          { material: 'hydrogen', fraction: 0.60 },
          { material: 'helium', fraction: 0.30 },
          { material: 'water', fraction: 0.10 },
        ],
        coreMassFraction: rng.range(0.50, 0.80),
      };
    case 'ice_giant':
      return {
        coreType: 'ice',
        coreComposition: [
          { material: 'water_ice', fraction: 0.60 },
          { material: 'ammonia_ice', fraction: 0.20 },
          { material: 'methane_ice', fraction: 0.10 },
          { material: 'silicate', fraction: 0.10 },
        ],
        mantleComposition: [
          { material: 'water', fraction: 0.50 },
          { material: 'ammonia', fraction: 0.25 },
          { material: 'methane', fraction: 0.25 },
        ],
        coreMassFraction: rng.range(0.70, 0.90),
      };
    case 'gas_giant':
      return {
        coreType: 'metallic_hydrogen',
        coreComposition: [
          { material: 'metallic_hydrogen', fraction: 0.85 },
          { material: 'helium', fraction: 0.10 },
          { material: 'heavier_elements', fraction: 0.05 },
        ],
        mantleComposition: [
          { material: 'hydrogen', fraction: 0.85 },
          { material: 'helium', fraction: 0.13 },
          { material: 'methane', fraction: 0.02 },
        ],
        coreMassFraction: rng.range(0.03, 0.15),
      };
    case 'dwarf':
    default:
      return {
        coreType: rng.chance(0.5) ? 'iron_nickel' : 'silicate',
        coreComposition: [
          { material: 'iron', fraction: 0.50 },
          { material: 'silicate', fraction: 0.40 },
          { material: 'other', fraction: 0.10 },
        ],
        mantleComposition: [
          { material: 'silicate', fraction: 0.80 },
          { material: 'ice', fraction: 0.20 },
        ],
        coreMassFraction: rng.range(0.20, 0.40),
      };
  }
}

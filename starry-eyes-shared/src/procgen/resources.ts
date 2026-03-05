import type { SeededRng } from './rng.js';
import type {
  PlanetClass, OrbitalZone, PlanetResources, PlanetInterior,
  PlanetSurface, ResourceLevel, AsteroidComposition,
} from './types.js';

const LEVELS: ResourceLevel[] = ['none', 'trace', 'poor', 'moderate', 'rich', 'exceptional'];

function levelFromIndex(i: number): ResourceLevel {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, Math.round(i)))];
}

function rLevel(rng: SeededRng, base: number, variance = 1): ResourceLevel {
  return levelFromIndex(base + rng.range(-variance, variance));
}

export function generateResources(
  rng: SeededRng,
  planetClass: PlanetClass,
  interior: PlanetInterior,
  surface: PlanetSurface | null,
  zone: OrbitalZone,
): PlanetResources {
  switch (planetClass) {
    case 'gas_giant':
      return {
        waterAvailability: rLevel(rng, 1),
        rareMetals: rLevel(rng, 0),
        commonMetals: rLevel(rng, 1),
        radioactives: rLevel(rng, 0),
        hydrocarbons: rLevel(rng, 2),
        volatiles: rLevel(rng, 4),
        exotics: rLevel(rng, 1),
      };
    case 'ice_giant':
      return {
        waterAvailability: rLevel(rng, 4),
        rareMetals: rLevel(rng, 0),
        commonMetals: rLevel(rng, 1),
        radioactives: rLevel(rng, 0),
        hydrocarbons: rLevel(rng, 3),
        volatiles: rLevel(rng, 4),
        exotics: rLevel(rng, 1),
      };
    default: break;
  }

  // Rocky / super-earth / mini-neptune / dwarf
  const ironCore = interior.coreType === 'iron_nickel';
  const iceCore = interior.coreType === 'ice';
  const surfType = surface?.surfaceType;

  return {
    waterAvailability: iceCore || surfType === 'oceanic' || surfType === 'frozen' ? rLevel(rng, 4) : rLevel(rng, 1),
    rareMetals: ironCore ? rLevel(rng, 3) : rLevel(rng, 1),
    commonMetals: ironCore ? rLevel(rng, 4) : rLevel(rng, 2),
    radioactives: surfType === 'volcanic' ? rLevel(rng, 3) : rLevel(rng, 1),
    hydrocarbons: surfType === 'carbon' ? rLevel(rng, 5) : rLevel(rng, 1),
    volatiles: zone === 'cold' || zone === 'outer' ? rLevel(rng, 3) : rLevel(rng, 1),
    exotics: surfType === 'carbon' ? rLevel(rng, 3) : rLevel(rng, 0),
  };
}

export function generateAsteroidResources(rng: SeededRng, composition: AsteroidComposition): PlanetResources {
  switch (composition) {
    case 'carbonaceous':
      return {
        waterAvailability: rLevel(rng, 3),
        rareMetals: rLevel(rng, 1),
        commonMetals: rLevel(rng, 1),
        radioactives: rLevel(rng, 0),
        hydrocarbons: rLevel(rng, 4),
        volatiles: rLevel(rng, 2),
        exotics: rLevel(rng, 0),
      };
    case 'silicate':
      return {
        waterAvailability: rLevel(rng, 1),
        rareMetals: rLevel(rng, 3),
        commonMetals: rLevel(rng, 3),
        radioactives: rLevel(rng, 1),
        hydrocarbons: rLevel(rng, 0),
        volatiles: rLevel(rng, 0),
        exotics: rLevel(rng, 1),
      };
    case 'metallic':
      return {
        waterAvailability: rLevel(rng, 0),
        rareMetals: rLevel(rng, 4),
        commonMetals: rLevel(rng, 4),
        radioactives: rLevel(rng, 1),
        hydrocarbons: rLevel(rng, 0),
        volatiles: rLevel(rng, 0),
        exotics: rLevel(rng, 3),
      };
    case 'icy':
      return {
        waterAvailability: rLevel(rng, 4),
        rareMetals: rLevel(rng, 0),
        commonMetals: rLevel(rng, 0),
        radioactives: rLevel(rng, 0),
        hydrocarbons: rLevel(rng, 1),
        volatiles: rLevel(rng, 4),
        exotics: rLevel(rng, 0),
      };
  }
}

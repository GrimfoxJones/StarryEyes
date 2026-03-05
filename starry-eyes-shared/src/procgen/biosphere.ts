import type { SeededRng } from './rng.js';
import type {
  PlanetClass, OrbitalZone, PlanetBiosphere,
  BiosphereComplexity, BiomassLevel, BiomeType, BiohazardType,
  PlanetPhysicalParams, PlanetAtmosphere,
} from './types.js';

export function generateBiosphere(
  rng: SeededRng,
  planetClass: PlanetClass,
  physical: PlanetPhysicalParams,
  atmosphere: PlanetAtmosphere,
  zone: OrbitalZone,
  systemAge: number,
): PlanetBiosphere {
  const noBio: PlanetBiosphere = {
    present: false, complexity: 'none', biomeTypes: [], biomass: 'none',
    oxygenProducing: false, hazards: [], compatibility: 0,
  };

  if (!atmosphere.present && planetClass !== 'ice_giant' && planetClass !== 'gas_giant') {
    // No atmosphere, no water → almost no chance
    if (!rng.chance(0.01)) return noBio;
  }

  const tEq = physical.equilibriumTemperature;
  const hasWater = atmosphere.composition.some(g => g.gas === 'H2O') || (tEq > 230 && tEq < 400);
  const ageGy = systemAge / 1e9;

  // Gas giant cloud life (speculative)
  if (planetClass === 'gas_giant' || planetClass === 'ice_giant') {
    if (rng.chance(0.02)) {
      return {
        present: true, complexity: 'microbial',
        biomeTypes: ['aerial'], biomass: 'sparse',
        oxygenProducing: false, hazards: ['incompatible_biochemistry'],
        compatibility: 0.1,
      };
    }
    return noBio;
  }

  // Frozen world with possible subsurface ocean
  if (zone !== 'habitable' && !hasWater) {
    if (rng.chance(0.10)) {
      return {
        present: true, complexity: 'microbial',
        biomeTypes: ['subsurface', 'hydrothermal'], biomass: 'trace',
        oxygenProducing: false, hazards: ['incompatible_biochemistry'],
        compatibility: 0.05,
      };
    }
    return noBio;
  }

  // Habitable zone with water
  if (zone === 'habitable' && hasWater) {
    if (ageGy > 2 && rng.chance(0.03)) {
      // Complex multicellular
      return makeBiosphere(rng, 'complex_multicellular', true);
    }
    if (ageGy > 2 && rng.chance(0.15)) {
      return makeBiosphere(rng, 'simple_multicellular', true);
    }
    if (ageGy > 1 && rng.chance(0.40)) {
      return makeBiosphere(rng, 'microbial', false);
    }
    if (rng.chance(0.15)) {
      return makeBiosphere(rng, 'prebiotic', false);
    }
    return noBio;
  }

  // Habitable zone without water, or warm zone
  if (rng.chance(0.05)) {
    return makeBiosphere(rng, 'microbial', false);
  }

  return noBio;
}

function makeBiosphere(
  rng: SeededRng,
  complexity: BiosphereComplexity,
  oxygenProducing: boolean,
): PlanetBiosphere {
  const biomeTypes = selectBiomes(rng, complexity);
  const biomass = selectBiomass(rng, complexity);
  const hazards = selectBiohazards(rng, complexity);
  const compatibility = complexity === 'complex_multicellular' ? rng.range(0.2, 0.7)
    : complexity === 'simple_multicellular' ? rng.range(0.3, 0.8)
    : rng.range(0.1, 0.4);

  return {
    present: true,
    complexity,
    biomeTypes,
    biomass,
    oxygenProducing: oxygenProducing && (complexity === 'simple_multicellular' || complexity === 'complex_multicellular'),
    hazards,
    compatibility,
  };
}

function selectBiomes(rng: SeededRng, complexity: BiosphereComplexity): BiomeType[] {
  if (complexity === 'prebiotic') return [];
  if (complexity === 'microbial') {
    return rng.chance(0.5) ? ['microbial_mat', 'hydrothermal'] : ['subsurface'];
  }
  if (complexity === 'simple_multicellular') {
    const biomes: BiomeType[] = ['microbial_mat', 'aquatic'];
    if (rng.chance(0.5)) biomes.push('tidal_zone');
    return biomes;
  }
  // Complex
  const biomes: BiomeType[] = ['aquatic', 'tidal_zone'];
  if (rng.chance(0.7)) biomes.push('forest');
  if (rng.chance(0.6)) biomes.push('grassland');
  if (rng.chance(0.3)) biomes.push('desert_adapted');
  return biomes;
}

function selectBiomass(rng: SeededRng, complexity: BiosphereComplexity): BiomassLevel {
  switch (complexity) {
    case 'prebiotic': return 'trace';
    case 'microbial': return rng.pick(['trace', 'sparse']);
    case 'simple_multicellular': return rng.pick(['sparse', 'moderate']);
    case 'complex_multicellular': return rng.pick(['moderate', 'abundant', 'extreme']);
    default: return 'none';
  }
}

function selectBiohazards(rng: SeededRng, complexity: BiosphereComplexity): BiohazardType[] {
  const hazards: BiohazardType[] = [];
  if (complexity === 'none' || complexity === 'prebiotic') return hazards;

  if (rng.chance(0.6)) hazards.push('incompatible_biochemistry');
  if (complexity === 'microbial' && rng.chance(0.2)) hazards.push('pathogenic');
  if (complexity === 'complex_multicellular') {
    if (rng.chance(0.3)) hazards.push('toxic_biome');
    if (rng.chance(0.2)) hazards.push('aggressive_fauna');
  }
  return hazards;
}

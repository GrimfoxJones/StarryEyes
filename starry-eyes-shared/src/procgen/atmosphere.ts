import type { SeededRng } from './rng.js';
import type {
  PlanetClass, OrbitalZone, PlanetAtmosphere, AtmosphericGas, AtmosphericHazard,
  PlanetPhysicalParams,
} from './types.js';

export function generateAtmosphere(
  rng: SeededRng,
  planetClass: PlanetClass,
  physical: PlanetPhysicalParams,
  zone: OrbitalZone,
): PlanetAtmosphere {
  const noAtmo: PlanetAtmosphere = {
    present: false, surfacePressure: 0, scaleHeight: 0,
    composition: [], hazards: [], cloudCover: 0, cloudType: null,
    greenhouseEffect: 0, breathable: false, colorTint: 0x000000,
  };

  // Determine if atmosphere exists
  const hasAtmo = rollAtmospherePresence(rng, planetClass, zone);
  if (!hasAtmo) return noAtmo;

  // Gas giants/ice giants always have atmosphere
  const isGaseous = planetClass === 'gas_giant' || planetClass === 'ice_giant';

  // Surface pressure
  let surfacePressure: number;
  if (isGaseous) {
    surfacePressure = 1000; // no meaningful "surface"
  } else if (planetClass === 'mini_neptune') {
    surfacePressure = rng.range(100, 10000);
  } else if (planetClass === 'super_earth') {
    surfacePressure = rng.range(1, 1000);
  } else if (planetClass === 'dwarf') {
    surfacePressure = rng.range(0.0001, 0.01);
  } else {
    // Rocky
    surfacePressure = zone === 'hot' ? rng.range(0.001, 100) : rng.range(0.1, 10);
  }

  // Composition based on temperature/type
  const tEq = physical.equilibriumTemperature;
  const composition = generateComposition(rng, planetClass, tEq, zone);

  // Scale height (approximate)
  const scaleHeight = 8500 * (tEq / 288) * (EARTH_MASS_KG / physical.mass) * (physical.radius / EARTH_RADIUS_M);

  // Greenhouse effect
  let greenhouseEffect = 0;
  if (surfacePressure > 10) {
    const co2 = composition.find(g => g.gas === 'CO2');
    const co2frac = co2 ? co2.fraction : 0;
    greenhouseEffect = 200 * co2frac * Math.log10(surfacePressure + 1);
  } else if (surfacePressure > 0.5) {
    const co2 = composition.find(g => g.gas === 'CO2');
    const co2frac = co2 ? co2.fraction : 0;
    greenhouseEffect = 33 * co2frac * surfacePressure;
  }

  // Cloud cover
  const cloudCover = isGaseous ? rng.range(0.8, 1.0) : rng.range(0, 0.8);
  const cloudType = determineCloudType(composition, tEq, isGaseous);

  // Hazards
  const hazards = determineHazards(composition, surfacePressure, tEq, physical);

  // Color tint
  const colorTint = atmosphereColor(composition, isGaseous, tEq);

  return {
    present: true,
    surfacePressure,
    scaleHeight: Math.max(1000, scaleHeight),
    composition,
    hazards,
    cloudCover,
    cloudType,
    greenhouseEffect,
    breathable: false, // will be checked after biosphere in planet.ts
    colorTint,
  };
}

const EARTH_MASS_KG = 5.972e24;
const EARTH_RADIUS_M = 6.371e6;

function rollAtmospherePresence(rng: SeededRng, planetClass: PlanetClass, zone: OrbitalZone): boolean {
  if (planetClass === 'gas_giant' || planetClass === 'ice_giant' || planetClass === 'mini_neptune') return true;
  if (planetClass === 'super_earth') return rng.chance(0.95);
  if (planetClass === 'dwarf') return rng.chance(0.10);

  // Rocky
  if (zone === 'hot') return rng.chance(0.30);
  if (zone === 'habitable') return rng.chance(0.80);
  return rng.chance(0.50);
}

function generateComposition(
  rng: SeededRng,
  planetClass: PlanetClass,
  tEq: number,
  zone: OrbitalZone,
): AtmosphericGas[] {
  if (planetClass === 'gas_giant') {
    if (tEq > 1000) {
      return normalize([
        { gas: 'H2', fraction: 0.80 + rng.range(-0.05, 0.05) },
        { gas: 'He', fraction: 0.15 + rng.range(-0.03, 0.03) },
        { gas: 'Na', fraction: rng.range(0.001, 0.01) },
        { gas: 'K', fraction: rng.range(0.001, 0.01) },
      ]);
    }
    return normalize([
      { gas: 'H2', fraction: 0.85 + rng.range(-0.05, 0.05) },
      { gas: 'He', fraction: 0.13 + rng.range(-0.03, 0.03) },
      { gas: 'CH4', fraction: rng.range(0.001, 0.02) },
      { gas: 'NH3', fraction: rng.range(0.001, 0.01) },
    ]);
  }

  if (planetClass === 'ice_giant') {
    return normalize([
      { gas: 'H2', fraction: 0.80 + rng.range(-0.05, 0.05) },
      { gas: 'He', fraction: 0.15 + rng.range(-0.03, 0.03) },
      { gas: 'CH4', fraction: rng.range(0.01, 0.05) },
      { gas: 'H2O', fraction: rng.range(0.001, 0.01) },
    ]);
  }

  if (planetClass === 'mini_neptune') {
    return normalize([
      { gas: 'H2', fraction: 0.70 + rng.range(-0.1, 0.1) },
      { gas: 'He', fraction: 0.20 + rng.range(-0.05, 0.05) },
      { gas: 'H2O', fraction: rng.range(0.01, 0.05) },
    ]);
  }

  // Rocky / super-earth / dwarf
  if (tEq > 700) {
    // Venus-like
    return normalize([
      { gas: 'CO2', fraction: 0.90 + rng.range(-0.1, 0.05) },
      { gas: 'SO2', fraction: rng.range(0.01, 0.05) },
      { gas: 'N2', fraction: rng.range(0.02, 0.08) },
    ]);
  }

  if (zone === 'habitable' || (tEq > 200 && tEq <= 700)) {
    // Temperate — pre-biotic default (O2 added later by biosphere)
    return normalize([
      { gas: 'N2', fraction: 0.75 + rng.range(-0.1, 0.1) },
      { gas: 'CO2', fraction: rng.range(0.01, 0.10) },
      { gas: 'H2O', fraction: rng.range(0.001, 0.03) },
      { gas: 'Ar', fraction: rng.range(0.005, 0.02) },
    ]);
  }

  // Cold
  return normalize([
    { gas: 'N2', fraction: 0.90 + rng.range(-0.1, 0.05) },
    { gas: 'CO2', fraction: rng.range(0.01, 0.05) },
    { gas: 'Ar', fraction: rng.range(0.01, 0.03) },
    { gas: 'CH4', fraction: rng.range(0.001, 0.02) },
  ]);
}

function normalize(gases: AtmosphericGas[]): AtmosphericGas[] {
  const total = gases.reduce((s, g) => s + g.fraction, 0);
  return gases.map(g => ({ gas: g.gas, fraction: g.fraction / total }));
}

function determineCloudType(composition: AtmosphericGas[], tEq: number, isGaseous: boolean): string | null {
  if (isGaseous) {
    return tEq > 500 ? 'silicate' : 'ammonia';
  }
  const co2 = composition.find(g => g.gas === 'CO2');
  if (co2 && co2.fraction > 0.5 && tEq > 400) return 'sulfuric_acid';
  const h2o = composition.find(g => g.gas === 'H2O');
  if (h2o && h2o.fraction > 0.001 && tEq > 200 && tEq < 400) return 'water';
  const ch4 = composition.find(g => g.gas === 'CH4');
  if (ch4 && ch4.fraction > 0.01 && tEq < 150) return 'methane';
  return null;
}

function determineHazards(
  composition: AtmosphericGas[],
  pressure: number,
  tEq: number,
  physical: PlanetPhysicalParams,
): AtmosphericHazard[] {
  const hazards: AtmosphericHazard[] = [];

  const so2 = composition.find(g => g.gas === 'SO2');
  if (so2 && so2.fraction > 0.01) hazards.push('toxic');

  if (composition.some(g => g.gas === 'SO2' && g.fraction > 0.03)) hazards.push('corrosive');

  if (pressure > 10) hazards.push('extreme_pressure');
  if (tEq > 400 || physical.surfaceTemperature > 400) hazards.push('extreme_heat');
  if (tEq < 150) hazards.push('extreme_cold');
  if (physical.magneticField === 'none') hazards.push('radiation');

  const h2 = composition.find(g => g.gas === 'H2');
  if (h2 && h2.fraction > 0.5) hazards.push('flammable');

  return hazards;
}

function atmosphereColor(composition: AtmosphericGas[], isGaseous: boolean, tEq: number): number {
  if (isGaseous) {
    if (tEq > 500) return 0xCC8844; // hot gas giant — orange haze
    return 0x88AACC; // cool gas giant — blue-ish
  }

  const co2 = composition.find(g => g.gas === 'CO2');
  if (co2 && co2.fraction > 0.5) return 0xFFCC66; // Venus-like yellow

  const ch4 = composition.find(g => g.gas === 'CH4');
  if (ch4 && ch4.fraction > 0.01) return 0xFF9944; // Titan-like orange

  return 0x88BBFF; // blue-white default
}

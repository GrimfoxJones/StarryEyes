import type { SeededRng } from './rng.js';
import type {
  StarParameters, PlanetClass, OrbitalZone, GeneratedPlanet,
  PlanetPhysicalParams, MagneticFieldStrength,
} from './types.js';
import { G } from '../constants.js';
import { planetName } from './naming.js';
import { generateAtmosphere } from './atmosphere.js';
import { generateSurface, generateInterior } from './surface.js';
import { generateBiosphere } from './biosphere.js';
import { generateRings } from './rings.js';
import { generateResources } from './resources.js';
import { generateMoons } from './moon.js';
import { classifyZone } from './zones.js';

const AU = 1.496e11; // meters
const EARTH_MASS = 5.972e24;
const EARTH_RADIUS = 6.371e6;

// ── Planet count by star type ────────────────────────────────────────

interface PlanetCountRange {
  min: number; max: number; avg: number;
}

const PLANET_COUNTS: Record<string, PlanetCountRange> = {
  O:             { min: 0, max: 1, avg: 0.2 },
  B:             { min: 0, max: 3, avg: 0.8 },
  A:             { min: 0, max: 5, avg: 2.5 },
  F:             { min: 1, max: 8, avg: 4.5 },
  G:             { min: 2, max: 10, avg: 6 },
  K:             { min: 1, max: 8, avg: 4.5 },
  M:             { min: 0, max: 6, avg: 3 },
  red_giant:     { min: 0, max: 4, avg: 1.5 },
  white_dwarf:   { min: 0, max: 3, avg: 0.8 },
  brown_dwarf:   { min: 0, max: 4, avg: 1.5 },
  neutron_star:  { min: 0, max: 2, avg: 0.3 },
  t_tauri:       { min: 0, max: 0, avg: 0 },
};

// ── Zone-based type selection weights ────────────────────────────────

type TypeWeights = [number, number, number, number, number]; // rocky, super_earth, mini_neptune, gas_giant, ice_giant
const ZONE_WEIGHTS: Record<OrbitalZone, TypeWeights> = {
  hot:       [50, 25, 10, 15, 0],
  habitable: [45, 30, 15, 5, 5],
  warm:      [30, 25, 25, 10, 10],
  cold:      [5, 10, 15, 45, 25],
  outer:     [5, 5, 10, 35, 45],
};

const PLANET_CLASSES: PlanetClass[] = ['rocky', 'super_earth', 'mini_neptune', 'gas_giant', 'ice_giant'];

// ── Public API ───────────────────────────────────────────────────────

export function generatePlanets(
  rng: SeededRng,
  star: StarParameters,
  habitableZone: { inner: number; outer: number },
  frostLine: number,
): GeneratedPlanet[] {
  const countRange = PLANET_COUNTS[star.spectralClass] ?? PLANET_COUNTS['G'];
  if (countRange.max === 0) return [];

  // Poisson-like draw, clamped, with metallicity bonus
  let count = rng.poisson(countRange.avg);
  count += Math.round(star.metallicity * 2); // higher metallicity → more planets
  count = Math.max(countRange.min, Math.min(countRange.max, count));
  if (count === 0) return [];

  // Place orbits using Titius-Bode-like spacing
  const baseDistance = 0.2 * Math.sqrt(star.luminositySolar) * AU;
  const spacing = rng.range(1.4, 2.2);
  const orbits: number[] = [];
  for (let n = 0; n < count; n++) {
    const jitter = rng.range(0.8, 1.2);
    orbits.push(baseDistance * Math.pow(spacing, n) * jitter);
  }

  // Assign planet types based on zone
  const planets: GeneratedPlanet[] = [];
  for (let i = 0; i < count; i++) {
    const a = orbits[i];
    const zone = classifyZone(a, habitableZone, frostLine);
    const planetClass = selectPlanetClass(rng, zone);
    const pName = planetName(star.name, i);
    const id = pName.toLowerCase().replace(/\s+/g, '_');

    const physical = generatePhysicalParams(rng, planetClass, a, star, zone);
    const atmosphere = generateAtmosphere(rng, planetClass, physical, zone);

    // Apply greenhouse effect to surface temperature
    physical.surfaceTemperature = physical.equilibriumTemperature + atmosphere.greenhouseEffect;

    const surface = (planetClass === 'gas_giant' || planetClass === 'ice_giant')
      ? null
      : generateSurface(rng, planetClass, physical, atmosphere, zone);

    const interior = generateInterior(rng, planetClass, zone);
    const biosphere = generateBiosphere(rng, planetClass, physical, atmosphere, zone, star.age);
    const rings = generateRings(rng, planetClass, physical);
    const resources = generateResources(rng, planetClass, interior, surface, zone);

    // Update atmosphere if biosphere produces oxygen
    if (biosphere.oxygenProducing && atmosphere.present) {
      const o2 = atmosphere.composition.find(g => g.gas === 'O2');
      if (!o2) {
        atmosphere.composition.push({ gas: 'O2', fraction: rng.range(0.15, 0.25) });
        // Renormalize
        const total = atmosphere.composition.reduce((s, g) => s + g.fraction, 0);
        for (const g of atmosphere.composition) g.fraction /= total;
      }
    }

    // Recheck breathability after biosphere updates
    atmosphere.breathable = checkBreathable(atmosphere, physical);

    const eccentricity = rng.rayleigh(0.05, 0.6);
    const direction: 1 | -1 = rng.chance(0.99) ? 1 : -1;

    const planet: GeneratedPlanet = {
      id,
      name: pName,
      designation: i + 1,
      semiMajorAxis: a,
      eccentricity,
      argumentOfPeriapsis: rng.range(0, Math.PI * 2),
      meanAnomalyAtEpoch: rng.range(0, Math.PI * 2),
      direction,
      planetClass,
      physical,
      interior,
      surface,
      atmosphere,
      biosphere,
      rings,
      resources,
      moons: [],
    };

    planets.push(planet);
  }

  // Hot Jupiter migration (10% for F, G, K stars)
  if (['F', 'G', 'K'].includes(star.spectralClass as string) && rng.chance(0.10)) {
    applyHotJupiterMigration(rng, planets);
  }

  // Ensure Hill sphere stability
  enforceHillSpacing(planets, star);

  // Generate moons for each planet
  for (const planet of planets) {
    planet.moons = generateMoons(rng, planet, star, habitableZone, frostLine);
  }

  return planets;
}

// classifyZone is imported from ./zones.js to avoid circular dependencies

// ── Planet type selection ────────────────────────────────────────────

function selectPlanetClass(rng: SeededRng, zone: OrbitalZone): PlanetClass {
  return rng.weighted(PLANET_CLASSES, ZONE_WEIGHTS[zone]);
}

// ── Physical parameters ──────────────────────────────────────────────

function generatePhysicalParams(
  rng: SeededRng,
  planetClass: PlanetClass,
  semiMajorAxis: number,
  star: StarParameters,
  _zone: OrbitalZone,
): PlanetPhysicalParams {
  const { mass, radius } = generateMassAndRadius(rng, planetClass);
  const density = mass / ((4 / 3) * Math.PI * Math.pow(radius, 3));
  const surfaceGravity = (G * mass) / (radius * radius);
  const escapeVelocity = Math.sqrt(2 * G * mass / radius);

  // Orbital period from Kepler's third law
  const orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / star.mu);

  // Tidal locking check
  const tidalLockDist = (star.spectralClass === 'M')
    ? 0.5 * Math.sqrt(star.luminositySolar) * AU
    : 0.1 * AU;
  const tidallyLocked = semiMajorAxis < tidalLockDist;

  // Rotation period
  let rotationPeriod: number;
  if (tidallyLocked) {
    rotationPeriod = orbitalPeriod;
  } else if (planetClass === 'gas_giant' || planetClass === 'ice_giant') {
    rotationPeriod = rng.range(8, 20) * 3600;
  } else {
    rotationPeriod = rng.range(8, 100) * 3600;
  }

  // Axial tilt
  let axialTilt = rng.range(0, 45);
  if (rng.chance(0.05)) axialTilt = rng.range(45, 90);

  // Albedo
  const albedo = planetClass === 'gas_giant' ? rng.range(0.3, 0.5)
    : planetClass === 'ice_giant' ? rng.range(0.25, 0.4)
    : rng.range(0.1, 0.4);

  // Equilibrium temperature
  const starRadiusM = star.radius;
  const tEq = star.surfaceTemperature * Math.sqrt(starRadiusM / (2 * semiMajorAxis)) * Math.pow(1 - albedo, 0.25);

  // Magnetic field
  const magneticField = determineMagneticField(planetClass, mass, rotationPeriod, tidallyLocked);

  return {
    mass,
    radius,
    density,
    surfaceGravity,
    escapeVelocity,
    orbitalPeriod,
    rotationPeriod,
    axialTilt,
    tidallyLocked,
    magneticField,
    albedo,
    equilibriumTemperature: tEq,
    surfaceTemperature: tEq, // will be updated with greenhouse effect
  };
}

function generateMassAndRadius(rng: SeededRng, planetClass: PlanetClass): { mass: number; radius: number } {
  let massEarth: number;
  let radiusEarth: number;

  switch (planetClass) {
    case 'dwarf':
      massEarth = rng.range(0.001, 0.1);
      radiusEarth = rng.range(0.1, 0.5);
      break;
    case 'rocky':
      massEarth = rng.range(0.1, 2);
      radiusEarth = Math.pow(massEarth, 0.27);
      break;
    case 'super_earth':
      massEarth = rng.range(2, 10);
      radiusEarth = Math.pow(massEarth, 0.27);
      break;
    case 'mini_neptune':
      massEarth = rng.range(2, 20);
      radiusEarth = 2.5 + rng.range(-0.5, 0.5);
      break;
    case 'gas_giant':
      massEarth = rng.range(20, 4000);
      if (massEarth > 318) {
        radiusEarth = 11.2 * Math.pow(massEarth / 318, -0.04);
      } else {
        radiusEarth = rng.range(6, 11.2);
      }
      break;
    case 'ice_giant':
      massEarth = rng.range(10, 80);
      radiusEarth = Math.pow(massEarth, 0.15) * 2.8;
      break;
    default:
      massEarth = 1;
      radiusEarth = 1;
  }

  return {
    mass: massEarth * EARTH_MASS,
    radius: radiusEarth * EARTH_RADIUS,
  };
}

function determineMagneticField(
  planetClass: PlanetClass,
  mass: number,
  rotationPeriod: number,
  tidallyLocked: boolean,
): MagneticFieldStrength {
  if (planetClass === 'gas_giant' || planetClass === 'ice_giant') return 'strong';
  if (tidallyLocked) return 'weak';

  const massEarth = mass / EARTH_MASS;
  const rotHours = rotationPeriod / 3600;

  if (massEarth > 0.5 && rotHours < 48) {
    return massEarth > 1 ? 'strong' : 'moderate';
  }
  if (massEarth < 0.2) return 'none';
  return 'weak';
}

// ── Hot Jupiter migration ────────────────────────────────────────────

function applyHotJupiterMigration(rng: SeededRng, planets: GeneratedPlanet[]): void {
  // Find outermost gas giant
  let gasGiantIdx = -1;
  for (let i = planets.length - 1; i >= 0; i--) {
    if (planets[i].planetClass === 'gas_giant') {
      gasGiantIdx = i;
      break;
    }
  }
  if (gasGiantIdx < 0) return;

  const hotJupiter = planets[gasGiantIdx];
  hotJupiter.semiMajorAxis = rng.range(0.02, 0.1) * AU;
  hotJupiter.eccentricity = rng.rayleigh(0.02, 0.1); // tidally circularized

  // Remove planets interior to the hot Jupiter's new orbit
  const migrated: GeneratedPlanet[] = [];
  for (const p of planets) {
    if (p === hotJupiter || p.semiMajorAxis > hotJupiter.semiMajorAxis) {
      migrated.push(p);
    }
  }
  planets.length = 0;
  planets.push(...migrated);

  // Re-sort by semi-major axis and re-designate
  planets.sort((a, b) => a.semiMajorAxis - b.semiMajorAxis);
}

// ── Hill sphere stability ────────────────────────────────────────────

function enforceHillSpacing(planets: GeneratedPlanet[], star: StarParameters): void {
  planets.sort((a, b) => a.semiMajorAxis - b.semiMajorAxis);

  for (let i = 1; i < planets.length; i++) {
    const prev = planets[i - 1];
    const curr = planets[i];
    const mutualHill = hillRadius(prev, star) + hillRadius(curr, star);
    const minSep = 5 * mutualHill;
    const actualSep = curr.semiMajorAxis - prev.semiMajorAxis;

    if (actualSep < minSep) {
      curr.semiMajorAxis = prev.semiMajorAxis + minSep;
    }
  }
}

function hillRadius(planet: GeneratedPlanet, star: StarParameters): number {
  return planet.semiMajorAxis * Math.pow(planet.physical.mass / (3 * star.mass), 1 / 3);
}

export { hillRadius };

// ── Breathability check ──────────────────────────────────────────────

function checkBreathable(
  atm: { present: boolean; surfacePressure: number; composition: { gas: string; fraction: number }[]; hazards: string[] },
  phys: { surfaceTemperature: number },
): boolean {
  if (!atm.present) return false;
  if (atm.surfacePressure < 0.5 || atm.surfacePressure > 2.0) return false;
  if (phys.surfaceTemperature < 230 || phys.surfaceTemperature > 320) return false;

  const o2 = atm.composition.find(g => g.gas === 'O2');
  if (!o2 || o2.fraction < 0.16 || o2.fraction > 0.30) return false;

  const co2 = atm.composition.find(g => g.gas === 'CO2');
  if (co2 && co2.fraction > 0.01) return false;

  if (atm.hazards.some(h => h === 'toxic' || h === 'corrosive')) return false;

  return true;
}

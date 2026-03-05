import type { SeededRng } from './rng.js';
import type {
  StarParameters, GeneratedPlanet, GeneratedMoon, PlanetClass,
  PlanetPhysicalParams, MagneticFieldStrength,
} from './types.js';
import { G } from '../constants.js';
import { moonName } from './naming.js';
import { generateAtmosphere } from './atmosphere.js';
import { generateSurface, generateInterior } from './surface.js';
import { generateBiosphere } from './biosphere.js';
import { generateResources } from './resources.js';
import { classifyZone } from './zones.js';

const AU = 1.496e11;
const EARTH_MASS = 5.972e24;
const EARTH_RADIUS = 6.371e6;
const MIN_MOON_ORBIT = 5e8; // 500,000 km

interface MoonCountRange { min: number; max: number; avg: number }

// Base moon counts (proper moons — not captured rocks)
const MOON_COUNTS: Record<PlanetClass, MoonCountRange> = {
  dwarf:        { min: 0, max: 0, avg: 0 },
  rocky:        { min: 0, max: 2, avg: 1.0 },
  super_earth:  { min: 0, max: 3, avg: 1.2 },
  mini_neptune: { min: 0, max: 4, avg: 1.5 },
  gas_giant:    { min: 1, max: 12, avg: 5 },
  ice_giant:    { min: 0, max: 8, avg: 3 },
};

// Hot-zone rocky/super-earth overrides — stellar radiation and tidal effects
// strip or prevent moon formation close to the star
const MOON_COUNTS_HOT: Partial<Record<PlanetClass, MoonCountRange>> = {
  rocky:        { min: 0, max: 1, avg: 0.15 },
  super_earth:  { min: 0, max: 1, avg: 0.3 },
};

// Captured asteroid counts for rocky/super-earth planets (not hot zone)
const CAPTURED_ROCK_COUNTS: Record<string, MoonCountRange> = {
  normal: { min: 0, max: 3, avg: 1.2 },
  hot:    { min: 0, max: 0, avg: 0 },
};

export function generateMoons(
  rng: SeededRng,
  planet: GeneratedPlanet,
  star: StarParameters,
  habitableZone: { inner: number; outer: number },
  frostLine: number,
): GeneratedMoon[] {
  const zone = classifyZone(planet.semiMajorAxis, habitableZone, frostLine);
  const isHot = zone === 'hot';

  // Determine moon count
  const hotOverride = isHot ? MOON_COUNTS_HOT[planet.planetClass] : undefined;
  const range = hotOverride ?? MOON_COUNTS[planet.planetClass];
  if (range.max === 0) return [];

  let count = rng.poisson(range.avg);
  count = Math.max(range.min, Math.min(range.max, count));

  // Captured asteroid count for rocky/super-earth
  let capturedRockCount = 0;
  if (planet.planetClass === 'rocky' || planet.planetClass === 'super_earth') {
    const rockRange = isHot ? CAPTURED_ROCK_COUNTS.hot : CAPTURED_ROCK_COUNTS.normal;
    capturedRockCount = rng.poisson(rockRange.avg);
    capturedRockCount = Math.max(rockRange.min, Math.min(rockRange.max, capturedRockCount));
  }

  const totalCount = count + capturedRockCount;
  if (totalCount === 0) return [];

  // Hill sphere radius (gameplay-inflated for rocky worlds so they can hold moons)
  const hillR = planet.semiMajorAxis * Math.pow(planet.physical.mass / (3 * star.mass), 1 / 3);
  const isSmallWorld = planet.planetClass === 'rocky' || planet.planetClass === 'super_earth' || planet.planetClass === 'dwarf';
  const maxMoonOrbit = (isSmallWorld ? 1.5 : 0.4) * hillR;
  const maxCapturedOrbit = (isSmallWorld ? 2.5 : 0.6) * hillR;

  if (maxMoonOrbit < MIN_MOON_ORBIT) return []; // can't fit any moons

  const spacing = rng.range(1.3, 1.8);
  const parentMu = G * planet.physical.mass;
  const moons: GeneratedMoon[] = [];

  // Place proper moons first, then captured rocks further out
  let nextOrbitSlot = 0;

  for (let i = 0; i < totalCount; i++) {
    const isCapturedRock = i >= count; // proper moons first, then captured

    const jitter = rng.range(0.85, 1.15);
    let orbit: number;
    if (isCapturedRock) {
      // Captured rocks orbit further out with wider spacing
      const rockSpacing = rng.range(1.5, 2.2);
      const baseOrbit = moons.length > 0
        ? moons[moons.length - 1].semiMajorAxis * rockSpacing
        : MIN_MOON_ORBIT * Math.pow(spacing, nextOrbitSlot);
      orbit = baseOrbit * jitter;
    } else {
      orbit = MIN_MOON_ORBIT * Math.pow(spacing, nextOrbitSlot) * jitter;
      nextOrbitSlot++;
    }
    if (orbit > (isCapturedRock ? maxCapturedOrbit : maxMoonOrbit)) break;

    const captured = isCapturedRock || rng.chance(0.20);

    // Moon mass: proper moons 10^-5 to 10^-2 of parent; captured rocks are smaller
    const massFraction = isCapturedRock
      ? Math.pow(10, rng.range(-7, -4))
      : Math.pow(10, rng.range(-5, -2));
    const moonMassKg = planet.physical.mass * massFraction;
    const moonMassEarth = moonMassKg / EARTH_MASS;

    const moonClass: PlanetClass = moonMassEarth > 0.1 ? 'rocky' : 'dwarf';
    const moonRadiusEarth = moonClass === 'rocky'
      ? Math.pow(moonMassEarth, 0.27)
      : Math.max(0.1, Math.pow(moonMassEarth, 0.3));
    const moonRadiusM = moonRadiusEarth * EARTH_RADIUS;

    const density = moonMassKg / ((4 / 3) * Math.PI * Math.pow(moonRadiusM, 3));
    const surfaceGravity = (G * moonMassKg) / (moonRadiusM * moonRadiusM);
    const escapeVelocity = Math.sqrt(2 * G * moonMassKg / moonRadiusM);
    const orbitalPeriod = 2 * Math.PI * Math.sqrt(Math.pow(orbit, 3) / parentMu);

    const tidallyLockedToParent = orbit < 1e9; // < 1M km
    const rotationPeriod = tidallyLockedToParent ? orbitalPeriod : rng.range(8, 100) * 3600;

    const eccentricity = isCapturedRock
      ? rng.rayleigh(0.20, 0.5)   // captured rocks: noticeably eccentric
      : captured
        ? rng.rayleigh(0.15, 0.4)
        : rng.rayleigh(0.03, 0.1);
    const direction: 1 | -1 = captured && rng.chance(0.3) ? -1 : 1;

    // Tidal heating estimate
    const tidalHeating = (eccentricity > 0.01 && planet.physical.mass > 100 * EARTH_MASS)
      ? rng.range(1e10, 1e15)
      : 0;

    // Equilibrium temperature from star
    const tEq = star.surfaceTemperature * Math.sqrt(star.radius / (2 * planet.semiMajorAxis)) * 0.9;

    const magneticField: MagneticFieldStrength =
      moonMassEarth > 0.5 && !tidallyLockedToParent ? 'moderate' : 'weak';

    const physical: PlanetPhysicalParams = {
      mass: moonMassKg,
      radius: moonRadiusM,
      density,
      surfaceGravity,
      escapeVelocity,
      orbitalPeriod,
      rotationPeriod,
      axialTilt: rng.range(0, 10),
      tidallyLocked: false, // to star — handled separately
      magneticField,
      albedo: rng.range(0.1, 0.4),
      equilibriumTemperature: tEq + (tidalHeating > 1e12 ? rng.range(10, 100) : 0),
      surfaceTemperature: tEq + (tidalHeating > 1e12 ? rng.range(10, 100) : 0),
    };

    // Determine zone for atmosphere/surface generation based on parent planet's zone
    const parentDist = planet.semiMajorAxis;
    const zone = parentDist < 2 * AU ? 'habitable' as const : 'cold' as const;

    const atmosphere = generateAtmosphere(rng, moonClass, physical, zone);
    physical.surfaceTemperature = physical.equilibriumTemperature + atmosphere.greenhouseEffect;

    const surface = generateSurface(rng, moonClass, physical, atmosphere, zone);
    const interior = generateInterior(rng, moonClass, zone);
    const biosphere = generateBiosphere(rng, moonClass, physical, atmosphere, zone, star.age);
    const resources = generateResources(rng, moonClass, interior, surface, zone);

    const mName = moonName(planet.name, i);
    const id = mName.toLowerCase().replace(/\s+/g, '_');

    moons.push({
      id,
      name: mName,
      designation: String.fromCharCode(97 + i),
      semiMajorAxis: orbit,
      eccentricity,
      argumentOfPeriapsis: rng.range(0, Math.PI * 2),
      meanAnomalyAtEpoch: rng.range(0, Math.PI * 2),
      direction,
      planetClass: moonClass,
      physical,
      interior,
      surface,
      atmosphere,
      biosphere,
      resources,
      tidalHeating,
      tidallyLockedToParent,
      capturedBody: captured,
    });
  }

  return moons;
}

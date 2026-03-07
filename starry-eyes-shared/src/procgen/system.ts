import { SeededRng } from './rng.js';
import type { GeneratedSystem } from './types.js';
import type { CelestialBody } from '../types.js';
import { G } from '../constants.js';
import { generateStar } from './star.js';
import { generatePlanets } from './planet.js';
import { generateAsteroids } from './asteroid.js';
import { generateStations } from './stations.js';
import { computeSettlement, computeSettledBodies } from './settlement.js';
import { derivePlanetColor, deriveAsteroidColor } from './colors.js';

const AU = 1.496e11;

export function generateSystem(seed: number, systemIndex = 0): GeneratedSystem {
  const rng = new SeededRng(seed);

  const star = generateStar(rng);

  // Derived zones
  const lumSolar = star.luminositySolar;
  const habitableZone = {
    inner: Math.sqrt(lumSolar / 1.1) * AU,
    outer: Math.sqrt(lumSolar / 0.53) * AU,
  };
  const frostLine = 4.85 * Math.sqrt(lumSolar) * AU;

  const planets = generatePlanets(rng, star, habitableZone, frostLine);
  const asteroids = generateAsteroids(rng, star, planets, frostLine);

  // Build partial system for settlement scoring & station generation
  const partialSystem: GeneratedSystem = {
    seed, star, planets, asteroids, stations: {}, settledBodies: {},
    systemAge: star.age, habitableZone, frostLine,
    gateOrbitRadius: 0, // computed below
  };
  const settlement = computeSettlement(partialSystem, systemIndex);
  const settledBodies = computeSettledBodies(partialSystem);
  const stationRng = new SeededRng(seed + 77777);
  const stations = generateStations(stationRng, partialSystem, settlement, settledBodies);

  // Gate orbit: sqrt(luminosity) * AU, clamped and nudged away from planets
  const baseGateRadius = Math.sqrt(star.luminositySolar) * AU;
  const outerPlanetA = planets.length > 0
    ? Math.max(...planets.map(p => p.semiMajorAxis))
    : 0;
  let gateOrbitRadius = Math.max(baseGateRadius, 2 * AU);
  if (outerPlanetA > 0) gateOrbitRadius = Math.min(gateOrbitRadius, outerPlanetA * 0.95);
  gateOrbitRadius = Math.max(gateOrbitRadius, 2 * AU);
  // Nudge if within 10% of any planet's semi-major axis
  for (const p of planets) {
    const ratio = gateOrbitRadius / p.semiMajorAxis;
    if (ratio > 0.9 && ratio < 1.1) {
      gateOrbitRadius = p.semiMajorAxis * 1.15;
    }
  }

  return {
    seed,
    star,
    planets,
    asteroids,
    stations,
    settledBodies,
    systemAge: star.age,
    habitableZone,
    frostLine,
    gateOrbitRadius,
  };
}

export function systemToBodies(system: GeneratedSystem, epoch = 0): CelestialBody[] {
  const bodies: CelestialBody[] = [];
  const rng = new SeededRng(system.seed + 99999); // separate RNG for colors

  // Star
  bodies.push({
    id: system.star.id,
    name: system.star.name,
    type: 'star',
    mass: system.star.mass,
    radius: system.star.radius,
    color: system.star.color,
    parentId: null,
    elements: null,
  });

  // Planets
  for (const planet of system.planets) {
    const planetMu = system.star.mu;
    bodies.push({
      id: planet.id,
      name: planet.name,
      type: 'planet',
      mass: planet.physical.mass,
      radius: planet.physical.radius,
      color: derivePlanetColor(rng, planet),
      parentId: system.star.id,
      planetClass: planet.planetClass,
      elements: {
        a: planet.semiMajorAxis,
        e: planet.eccentricity,
        omega: planet.argumentOfPeriapsis,
        M0: planet.meanAnomalyAtEpoch,
        epoch,
        mu: planetMu,
        direction: planet.direction,
      },
    });

    // Moons
    const moonMu = G * planet.physical.mass;
    for (const moon of planet.moons) {
      bodies.push({
        id: moon.id,
        name: moon.name,
        type: 'moon',
        mass: moon.physical.mass,
        radius: moon.physical.radius,
        color: derivePlanetColor(rng, moon),
        parentId: planet.id,
        planetClass: moon.planetClass,
        elements: {
          a: moon.semiMajorAxis,
          e: moon.eccentricity,
          omega: moon.argumentOfPeriapsis,
          M0: moon.meanAnomalyAtEpoch,
          epoch,
          mu: moonMu,
          direction: moon.direction,
        },
      });
    }
  }

  // Jump Gate
  {
    const gateArgP = rng.range(0, 2 * Math.PI);
    const gateM0 = rng.range(0, 2 * Math.PI);
    bodies.push({
      id: `${system.star.id}_gate`,
      name: `${system.star.name} Gate`,
      type: 'gate',
      mass: 1e6,
      radius: 5e3,
      color: 0x00FFAA,
      parentId: system.star.id,
      elements: {
        a: system.gateOrbitRadius,
        e: 0,
        omega: gateArgP,
        M0: gateM0,
        epoch,
        mu: system.star.mu,
        direction: 1,
      },
    });
  }

  // Asteroids
  for (const asteroid of system.asteroids) {
    bodies.push({
      id: asteroid.id,
      name: asteroid.name,
      type: 'asteroid',
      mass: asteroid.mass,
      radius: asteroid.radius,
      color: deriveAsteroidColor(asteroid.composition),
      parentId: system.star.id,
      elements: {
        a: asteroid.semiMajorAxis,
        e: asteroid.eccentricity,
        omega: asteroid.argumentOfPeriapsis,
        M0: asteroid.meanAnomalyAtEpoch,
        epoch,
        mu: system.star.mu,
        direction: asteroid.direction,
      },
    });
  }

  return bodies;
}

/**
 * Find a suitable starting body for the player ship.
 * Priority: highest-pop settled body > habitable zone planet > largest rocky world > any planet > null.
 */
export function findStartingBody(system: GeneratedSystem): string | null {
  const { planets, habitableZone, settledBodies } = system;
  if (planets.length === 0) return null;

  // Highest-population settled body
  const settledEntries = Object.values(settledBodies);
  if (settledEntries.length > 0) {
    settledEntries.sort((a, b) => b.surfacePopulation - a.surfacePopulation);
    return settledEntries[0].bodyId;
  }

  // Habitable zone planet
  const hzPlanet = planets.find(p =>
    p.semiMajorAxis >= habitableZone.inner &&
    p.semiMajorAxis <= habitableZone.outer &&
    (p.planetClass === 'rocky' || p.planetClass === 'super_earth')
  );
  if (hzPlanet) return hzPlanet.id;

  // Largest rocky/super-earth
  const rocky = planets
    .filter(p => p.planetClass === 'rocky' || p.planetClass === 'super_earth')
    .sort((a, b) => b.physical.mass - a.physical.mass);
  if (rocky.length > 0) return rocky[0].id;

  // Any planet
  return planets[0].id;
}

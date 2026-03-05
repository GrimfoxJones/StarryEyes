import type { SeededRng } from './rng.js';
import type {
  StarParameters, GeneratedPlanet, GeneratedAsteroid,
  AsteroidComposition, AsteroidShape,
} from './types.js';
import { asteroidName } from './naming.js';
import { generateAsteroidResources } from './resources.js';

export function generateAsteroids(
  rng: SeededRng,
  star: StarParameters,
  planets: GeneratedPlanet[],
  frostLine: number,
): GeneratedAsteroid[] {
  const asteroids: GeneratedAsteroid[] = [];
  let designation = 1;

  // Find potential belt zones
  const hasRocky = planets.some(p => ['rocky', 'super_earth', 'dwarf'].includes(p.planetClass));
  const hasGasGiant = planets.some(p => p.planetClass === 'gas_giant' || p.planetClass === 'ice_giant');

  // Sort planets by distance
  const sorted = [...planets].sort((a, b) => a.semiMajorAxis - b.semiMajorAxis);

  // Inner belt: between rocky and gas giant zones (60% chance)
  if (hasRocky && hasGasGiant && rng.chance(0.60)) {
    const lastRocky = sorted.filter(p => ['rocky', 'super_earth'].includes(p.planetClass)).pop();
    const firstGiant = sorted.find(p => p.planetClass === 'gas_giant' || p.planetClass === 'ice_giant');

    if (lastRocky && firstGiant && firstGiant.semiMajorAxis > lastRocky.semiMajorAxis * 1.2) {
      const beltInner = lastRocky.semiMajorAxis * 1.1;
      const beltOuter = firstGiant.semiMajorAxis * 0.7;

      if (beltOuter > beltInner) {
        const count = rng.int(10, 20);
        for (let i = 0; i < count; i++) {
          asteroids.push(generateAsteroid(rng, star, beltInner, beltOuter, 'inner', designation, i === 0));
          designation++;
        }
      }
    }
  }

  // Outer belt: beyond the outermost gas giant (30% chance)
  if (hasGasGiant && rng.chance(0.30)) {
    const outermost = sorted[sorted.length - 1];
    const beltInner = outermost.semiMajorAxis * 1.3;
    const beltOuter = beltInner * 2.5;

    const count = rng.int(8, 15);
    for (let i = 0; i < count; i++) {
      asteroids.push(generateAsteroid(rng, star, beltInner, beltOuter, 'outer', designation, i === 0));
      designation++;
    }
  }

  // If no belts generated but we have planets, add a sparse scattering
  if (asteroids.length === 0 && planets.length > 0) {
    const innerA = sorted[0].semiMajorAxis * 0.5;
    const outerA = sorted[sorted.length - 1].semiMajorAxis * 1.5;
    const count = rng.int(5, 10);
    for (let i = 0; i < count; i++) {
      asteroids.push(generateAsteroid(rng, star, innerA, outerA, frostLine > innerA ? 'inner' : 'outer', designation, i === 0));
      designation++;
    }
  }

  return asteroids;
}

function generateAsteroid(
  rng: SeededRng,
  star: StarParameters,
  beltInner: number,
  beltOuter: number,
  beltType: 'inner' | 'outer',
  designation: number,
  isLargest: boolean,
): GeneratedAsteroid {
  const a = rng.range(beltInner, beltOuter);
  const e = rng.rayleigh(0.10, 0.4);

  // Mass: power law distribution
  let radius: number;
  if (isLargest) {
    radius = rng.range(200e3, 500e3); // 200-500 km
  } else {
    // Power law: many small, few large
    const u = rng.next();
    radius = 1e3 * Math.pow(10, u * 2.5); // 1 km to ~300 km
    radius = Math.min(radius, 300e3);
  }

  const density = rng.range(1500, 5000); // kg/m³
  const mass = density * (4 / 3) * Math.PI * Math.pow(radius, 3);

  // Composition
  const compositionWeights = beltType === 'inner'
    ? [50, 30, 15, 5]
    : [20, 15, 5, 60];
  const compositions: AsteroidComposition[] = ['carbonaceous', 'silicate', 'metallic', 'icy'];
  const composition = rng.weighted(compositions, compositionWeights);

  const shapes: AsteroidShape[] = ['spheroidal', 'elongated', 'irregular', 'contact_binary'];
  const shape = radius > 200e3
    ? 'spheroidal'
    : rng.weighted(shapes, [15, 30, 40, 15]);

  const name = asteroidName(star.name, designation);
  const id = name.toLowerCase().replace(/\s+/g, '_');

  return {
    id,
    name,
    designation,
    semiMajorAxis: a,
    eccentricity: e,
    argumentOfPeriapsis: rng.range(0, Math.PI * 2),
    meanAnomalyAtEpoch: rng.range(0, Math.PI * 2),
    direction: 1,
    mass,
    radius,
    density,
    rotationPeriod: rng.range(2, 100) * 3600, // 2-100 hours
    shape,
    composition,
    resources: generateAsteroidResources(rng, composition),
  };
}

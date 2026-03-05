import type { SeededRng } from './rng.js';
import type { PlanetClass, RingSystem, PlanetPhysicalParams } from './types.js';

export function generateRings(
  rng: SeededRng,
  planetClass: PlanetClass,
  physical: PlanetPhysicalParams,
): RingSystem | null {
  let chance: number;
  switch (planetClass) {
    case 'gas_giant': chance = 0.40; break;
    case 'ice_giant': chance = 0.60; break;
    case 'rocky':
    case 'super_earth':
      chance = 0.01; break;
    default: return null;
  }

  if (!rng.chance(chance)) return null;

  const innerRadius = 1.5 * physical.radius; // Roche limit
  const outerRadius = rng.range(2.0, 5.0) * physical.radius;

  const composition = planetClass === 'ice_giant'
    ? (rng.chance(0.7) ? 'ice' as const : 'mixed' as const)
    : rng.weighted(['ice', 'rock', 'mixed'] as const, [40, 30, 30]);

  const opacity = planetClass === 'ice_giant' ? rng.range(0.1, 0.4) : rng.range(0.3, 0.9);

  const colorTint = composition === 'ice' ? 0xDDEEFF
    : composition === 'rock' ? 0xAA9977
    : 0xCCBB99;

  return {
    present: true,
    innerRadius,
    outerRadius,
    composition,
    opacity,
    colorTint,
  };
}

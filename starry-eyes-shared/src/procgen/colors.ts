import type { SeededRng } from './rng.js';
import type { GeneratedPlanet, GeneratedMoon, AsteroidComposition, SurfaceType } from './types.js';

const SURFACE_COLORS: Record<SurfaceType, [number, number]> = {
  barren_rocky: [0xA0A0A0, 0x808080],
  volcanic:     [0xFF4500, 0xCC3300],
  frozen:       [0xE0F0FF, 0xB0D0E0],
  desert:       [0xD2B48C, 0xC8A070],
  oceanic:      [0x1E90FF, 0x0066CC],
  terrestrial:  [0x4A90E2, 0x3A7BC8],
  greenhouse:   [0xFFD700, 0xCC9900],
  carbon:       [0x2F2F2F, 0x1A1A1A],
  lava:         [0xFF2200, 0xCC0000],
  ice_rock:     [0xD4C4A8, 0xB0A080],
};

const GAS_GIANT_COLORS: [number, number] = [0xC88B3A, 0x8B6914];
const ICE_GIANT_COLORS: [number, number] = [0x4FC3F7, 0x0097A7];

export function derivePlanetColor(rng: SeededRng, planet: GeneratedPlanet | GeneratedMoon): number {
  if ('rings' in planet && planet.planetClass === 'gas_giant') {
    return lerpColor(rng, GAS_GIANT_COLORS[0], GAS_GIANT_COLORS[1]);
  }
  if ('rings' in planet && planet.planetClass === 'ice_giant') {
    return lerpColor(rng, ICE_GIANT_COLORS[0], ICE_GIANT_COLORS[1]);
  }
  if (planet.planetClass === 'mini_neptune') {
    return lerpColor(rng, 0x6699CC, 0x4477AA);
  }

  const surfaceType = planet.surface?.surfaceType ?? 'barren_rocky';
  const [c1, c2] = SURFACE_COLORS[surfaceType] ?? SURFACE_COLORS.barren_rocky;
  return lerpColor(rng, c1, c2);
}

const ASTEROID_COLORS: Record<AsteroidComposition, number> = {
  carbonaceous: 0x555544,
  silicate:     0x998877,
  metallic:     0xBBBBAA,
  icy:          0xCCDDEE,
};

export function deriveAsteroidColor(composition: AsteroidComposition): number {
  return ASTEROID_COLORS[composition];
}

function lerpColor(rng: SeededRng, c1: number, c2: number): number {
  const t = rng.next();
  const r1 = (c1 >> 16) & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF;
  const r2 = (c2 >> 16) & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

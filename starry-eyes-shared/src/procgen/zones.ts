import type { OrbitalZone } from './types.js';

export function classifyZone(
  distance: number,
  habitableZone: { inner: number; outer: number },
  frostLine: number,
): OrbitalZone {
  if (distance < 0.5 * habitableZone.inner) return 'hot';
  if (distance <= habitableZone.outer) {
    if (distance >= habitableZone.inner) return 'habitable';
    return 'hot';
  }
  if (distance <= frostLine) return 'warm';
  if (distance <= 10 * frostLine) return 'cold';
  return 'outer';
}

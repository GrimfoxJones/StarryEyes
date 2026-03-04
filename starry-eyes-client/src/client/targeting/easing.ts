/** Clamp value to [0, 1] */
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** easeOutBack — overshoots slightly then settles */
export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

/** easeOutQuad — decelerating */
export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Compute a phase's progress given elapsed time and phase start/end */
export function phaseProgress(elapsedMs: number, startMs: number, endMs: number): number {
  if (elapsedMs < startMs) return 0;
  if (elapsedMs >= endMs) return 1;
  return (elapsedMs - startMs) / (endMs - startMs);
}

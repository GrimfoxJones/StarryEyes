import { lerp } from './easing.ts';

/** Offset from reticle center to info box anchor */
const LINE_LENGTH = 100;
const LINE_ANGLE_DEG = 12;
const ELBOW_HEIGHT = 12;

export interface PlacementResult {
  /** Direction multipliers (-1 or 1) */
  dirX: number;
  dirY: number;
  /** End of connector line (info box anchor) */
  endX: number;
  endY: number;
  /** Elbow point (where line turns vertical) */
  elbowX: number;
  elbowY: number;
}

/** Compute placement based on target's screen position */
export function computePlacement(
  targetX: number,
  targetY: number,
  viewportW: number,
  viewportH: number,
): PlacementResult {
  const dirX = targetX < viewportW / 2 ? 1 : -1;
  const dirY = targetY < viewportH / 2 ? 1 : -1;

  const angleRad = (LINE_ANGLE_DEG * Math.PI) / 180;
  const dx = Math.cos(angleRad) * LINE_LENGTH * dirX;
  const dy = Math.sin(angleRad) * LINE_LENGTH * dirY;

  const elbowX = targetX + dx;
  const elbowY = targetY + dy;
  const endX = elbowX;
  const endY = elbowY + ELBOW_HEIGHT * dirY;

  return { dirX, dirY, endX, endY, elbowX, elbowY };
}

/** Smoothly interpolate between two placements */
export function lerpPlacement(a: PlacementResult, b: PlacementResult, t: number): PlacementResult {
  return {
    dirX: b.dirX,
    dirY: b.dirY,
    endX: lerp(a.endX, b.endX, t),
    endY: lerp(a.endY, b.endY, t),
    elbowX: lerp(a.elbowX, b.elbowX, t),
    elbowY: lerp(a.elbowY, b.elbowY, t),
  };
}

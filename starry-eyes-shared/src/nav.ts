import type { Vec2, Route, Destination, ShipState, CelestialBody } from './types.js';
import { vec2Add, vec2Scale, vec2Length, vec2Normalize, vec2Dist } from './types.js';

// ── Brachistochrone math ────────────────────────────────────────────

/** Total transit time for brachistochrone from rest (accel half, decel half). */
export function brachistochroneTime(distance: number, accel: number): number {
  return 2 * Math.sqrt(distance / accel);
}

/** Fuel cost for a transit (engines burn the entire time). */
export function brachistochroneFuelCost(transitTime: number, fuelRate: number): number {
  return fuelRate * transitTime;
}

/**
 * Asymmetric brachistochrone with initial speed v0.
 *
 * The ship accelerates from v0 to peakSpeed, then decelerates from peakSpeed to 0.
 * peakSpeed = sqrt(a * arcLength + v0² / 2)
 * accelTime = (peakSpeed - v0) / a
 * decelTime = peakSpeed / a
 * totalTime = accelTime + decelTime
 *
 * When v0 = 0 this reduces to the standard symmetric brachistochrone.
 */
function transitTimeWithSpeed(arcLength: number, accel: number, v0: number): number {
  // Clamp v0 so ship can decelerate to 0 within arcLength (safety net)
  const maxV0 = Math.sqrt(2 * accel * arcLength);
  const v0c = Math.min(v0, maxV0);
  const peakSpeed = Math.sqrt(accel * arcLength + v0c * v0c / 2);
  return (2 * peakSpeed - v0c) / accel;
}

// ── Bézier helpers ──────────────────────────────────────────────────

/** Evaluate quadratic Bézier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2 */
function evaluateBezier(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/** Tangent of quadratic Bézier: B'(t) = 2(1-t)(P1-P0) + 2t(P2-P1) */
function bezierTangent(p0: Vec2, p1: Vec2, p2: Vec2, t: number): Vec2 {
  const u = 1 - t;
  return {
    x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

/** Approximate arc length by summing segment lengths. */
function approximateArcLength(p0: Vec2, p1: Vec2, p2: Vec2, segments: number): number {
  let total = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const pt = evaluateBezier(p0, p1, p2, i / segments);
    total += vec2Dist(prev, pt);
    prev = pt;
  }
  return total;
}

/** Build lookup table mapping Bézier t → cumulative arc distance. */
function buildArcLengthTable(
  p0: Vec2, p1: Vec2, p2: Vec2, segments: number,
): { t: number; dist: number }[] {
  const table: { t: number; dist: number }[] = [{ t: 0, dist: 0 }];
  let totalDist = 0;
  let prev = p0;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const pt = evaluateBezier(p0, p1, p2, t);
    totalDist += vec2Dist(prev, pt);
    table.push({ t, dist: totalDist });
    prev = pt;
  }
  return table;
}

/** Convert distance along curve → Bézier t parameter via linear interpolation. */
function distanceToParameter(
  table: readonly { readonly t: number; readonly dist: number }[],
  targetDist: number,
): number {
  for (let i = 1; i < table.length; i++) {
    if (table[i].dist >= targetDist) {
      const prev = table[i - 1];
      const curr = table[i];
      const range = curr.dist - prev.dist;
      if (range < 1e-12) return curr.t;
      const frac = (targetDist - prev.dist) / range;
      return prev.t + frac * (curr.t - prev.t);
    }
  }
  return 1;
}

// ── Transit position along Bézier route ─────────────────────────────

/**
 * Position, velocity, heading, and decel state along a Bézier route at a given game time.
 *
 * Uses an asymmetric brachistochrone profile when initialSpeed > 0:
 *   Accel phase: v0 → peakSpeed  (shorter than decel phase)
 *   Decel phase: peakSpeed → 0
 *
 * When initialSpeed = 0, this reduces to the standard symmetric brachistochrone.
 */
export function transitPositionAtTime(
  route: Route,
  currentTime: number,
): { position: Vec2; velocity: Vec2; heading: Vec2; isDecelerating: boolean } {
  const elapsed = Math.max(0, Math.min(currentTime - route.startTime, route.totalTime));
  const a = route.acceleration;
  const v0 = route.initialSpeed;

  // Compute asymmetric profile parameters
  const maxV0 = Math.sqrt(2 * a * route.arcLength);
  const v0c = Math.min(v0, maxV0);
  const peakSpeed = Math.sqrt(a * route.arcLength + v0c * v0c / 2);
  const accelTime = (peakSpeed - v0c) / a;

  let dist: number;
  let speed: number;
  let isDecelerating: boolean;

  if (elapsed <= accelTime) {
    // Accelerating from v0 to peakSpeed
    dist = v0c * elapsed + 0.5 * a * elapsed * elapsed;
    speed = v0c + a * elapsed;
    isDecelerating = false;
  } else {
    // Decelerating from peakSpeed to 0
    const t2 = elapsed - accelTime;
    const accelDist = v0c * accelTime + 0.5 * a * accelTime * accelTime;
    dist = accelDist + peakSpeed * t2 - 0.5 * a * t2 * t2;
    speed = peakSpeed - a * t2;
    isDecelerating = true;
  }

  // Map distance → Bézier parameter
  const bezierT = distanceToParameter(route.arcTable, dist);

  // Evaluate position on curve
  const position = evaluateBezier(route.startPos, route.controlPoint, route.interceptPos, bezierT);

  // Tangent direction at this point
  const tangent = bezierTangent(route.startPos, route.controlPoint, route.interceptPos, bezierT);
  const tangentDir = vec2Normalize(tangent);

  // Velocity: tangent direction × speed
  const velocity = vec2Scale(tangentDir, Math.max(0, speed));

  // Heading: tangent during accel, flipped during decel
  const heading = isDecelerating ? vec2Scale(tangentDir, -1) : tangentDir;

  return { position, velocity, heading, isDecelerating };
}

// ── Route sampling ──────────────────────────────────────────────────

/** Sample future positions along a route for rendering route lines / prediction. */
export function sampleRouteAhead(
  route: Route,
  currentTime: number,
  numPoints: number,
): Vec2[] {
  const points: Vec2[] = [];
  const remaining = Math.max(0, (route.startTime + route.totalTime) - currentTime);
  if (remaining <= 0 || numPoints < 2) return points;

  for (let i = 0; i <= numPoints; i++) {
    const t = currentTime + (remaining * i) / numPoints;
    const result = transitPositionAtTime(route, t);
    points.push(result.position);
  }
  return points;
}

// ── Route computation ───────────────────────────────────────────────

type BodyPositionFn = (bodyId: string, time: number) => Vec2;

export function computeRoute(
  ship: ShipState,
  destination: Destination,
  gameTime: number,
  bodies: readonly CelestialBody[],
  bodyPositionFn: BodyPositionFn,
): Route | null {
  const accel = ship.maxAcceleration;

  // If mid-transit, derive current position/velocity from the active route
  // (ship.velocity may be stale — only updated on tick, not between ticks)
  let p0 = ship.position;
  let currentVel = ship.velocity;
  if (ship.route && ship.mode === 'transit') {
    const current = transitPositionAtTime(ship.route, gameTime);
    p0 = current.position;
    currentVel = current.velocity;
  }

  const initialSpeed = vec2Length(currentVel);
  const velDir = initialSpeed > 1e-6 ? vec2Normalize(currentVel) : null;

  // Resolve initial destination position
  let p2: Vec2;
  const targetBodyId = destination.type === 'body' ? destination.bodyId : null;

  if (targetBodyId) {
    const body = bodies.find(b => b.id === targetBodyId);
    if (!body) return null;
    p2 = bodyPositionFn(targetBodyId, gameTime);
  } else if (destination.type === 'point') {
    p2 = destination.position;
  } else {
    return null;
  }

  // Iteratively converge: P2 (body intercept), P1, arcLength, transitTime
  let transitTime = 0;
  let arcLen = 0;
  let p1: Vec2;

  for (let iter = 0; iter < 10; iter++) {
    // Update P2 for moving body targets
    if (targetBodyId) {
      p2 = bodyPositionFn(targetBodyId, gameTime + transitTime);
    }

    const straightDist = vec2Dist(p0, p2);
    if (straightDist < 1) return null;

    // Compute P1 (control point)
    if (velDir) {
      const velocityInfluence = Math.min(initialSpeed * transitTime * 0.25, straightDist * 0.4);
      p1 = vec2Add(p0, vec2Scale(velDir, velocityInfluence));
    } else {
      // From rest: midpoint → straight line
      p1 = vec2Scale(vec2Add(p0, p2), 0.5);
    }

    // Use fewer segments during iteration for speed
    arcLen = approximateArcLength(p0, p1, p2, 20);
    if (arcLen < 1) return null;

    transitTime = transitTimeWithSpeed(arcLen, accel, initialSpeed);
  }

  // Final high-quality arc table with converged P1
  const arcTable = buildArcLengthTable(p0, p1!, p2, 50);
  arcLen = arcTable[arcTable.length - 1].dist;
  transitTime = transitTimeWithSpeed(arcLen, accel, initialSpeed);

  return {
    startPos: p0,
    controlPoint: p1!,
    interceptPos: p2,
    startTime: gameTime,
    initialSpeed,
    arcLength: arcLen,
    totalTime: transitTime,
    acceleration: accel,
    targetBodyId,
    arcTable,
    fuelAtRouteStart: 0,
    fuelConsumptionRate: 0,
  };
}

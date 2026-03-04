# StarryEyes — Route Computation: Handling Course Changes

## The Problem

When a player changes destination mid-transit, the ship has an existing velocity vector. The nav computer must redirect to the new destination WITHOUT first cancelling all velocity and starting from zero. The ship should smoothly curve toward its new destination, carrying its existing momentum into the new route.

## The Mental Model

Think of it like a car on a highway. If you miss your exit, you don't slam the brakes to a dead stop and then start driving toward the exit. You curve off the road in a smooth arc. Your existing speed carries into the turn. The faster you were going, the wider the arc.

A ship at velocity V heading toward Jupiter that redirects to Mars doesn't stop, rotate, and restart. It begins a smooth arc that gradually bends its trajectory from "toward Jupiter" to "toward Mars." The existing velocity is not wasted — the component that's useful for the new heading is kept, and the ship's thrust gradually corrects the rest.

## The Solution: Bézier Curve Route

Represent every route as a quadratic Bézier curve, not a straight line. This handles both the simple case (starting from rest) and the redirect case (starting with velocity) with the same code.

### Quadratic Bézier

A quadratic Bézier curve has three control points: P0, P1, P2.

```
B(t) = (1-t)² × P0 + 2(1-t)t × P1 + t² × P2
```

Where t goes from 0 to 1 over the transit duration.

- **P0** = starting position (where the ship is right now)
- **P2** = destination (intercept point, after convergence iteration)
- **P1** = control point that encodes the initial velocity direction

### Computing the Control Point (P1)

This is the key to the whole thing.

**Starting from rest (departing a planet, no existing velocity):**

P1 sits on the straight line between P0 and P2 — so the Bézier degenerates into a straight line. Simple.

```typescript
// From rest: P1 is just the midpoint. Curve is a straight line.
const P1 = midpoint(P0, P2);
```

**Starting with velocity (mid-transit redirect):**

P1 is placed along the ship's current velocity vector, extended outward from P0. This makes the curve's tangent at t=0 match the ship's current heading — the ship starts by continuing in roughly its current direction and gradually curves toward the new target.

```typescript
// With velocity: P1 extends from P0 along current velocity direction.
// The distance of P1 from P0 controls how "wide" the curve is.
// Larger velocityInfluence = wider arc (more momentum carried forward).

const speed = magnitude(currentVelocity);
const velocityDirection = normalize(currentVelocity);
const totalDistance = distance(P0, P2);

// Scale factor: how far along the velocity direction to place P1.
// This controls the curve shape. Tune this for feel.
// A good starting point: proportional to how fast you're going
// relative to the total trip distance.
const velocityInfluence = Math.min(speed * transitTime * 0.25, totalDistance * 0.4);

const P1 = {
  x: P0.x + velocityDirection.x * velocityInfluence,
  y: P0.y + velocityDirection.y * velocityInfluence,
};
```

The `velocityInfluence` factor is a tuning parameter. Higher = wider arcs (more momentum preserved). Lower = tighter turns (more aggressive course correction). Cap it so P1 never goes past the destination.

### Acceleration Profile Along the Curve

The ship still does a brachistochrone: accelerate for the first half, decelerate for the second half. But "first half" and "second half" are measured along the Bézier curve, not a straight line.

```typescript
// Get total arc length of the Bézier (approximate with line segments)
const arcLength = approximateArcLength(P0, P1, P2, segments=50);

// Brachistochrone transit time based on arc length
const transitTime = 2 * Math.sqrt(arcLength / shipAcceleration);

// Position at game time T:
// 1. Compute how far along the curve the ship is (using acceleration profile)
// 2. Convert that distance to a Bézier t parameter
// 3. Evaluate the Bézier at that t

function getPositionAtTime(elapsedTime: number): Vec2 {
  const halfTime = transitTime / 2;

  let distanceAlongCurve: number;

  if (elapsedTime <= halfTime) {
    // Accelerating
    distanceAlongCurve = 0.5 * shipAcceleration * elapsedTime * elapsedTime;
  } else {
    // Decelerating
    const t2 = elapsedTime - halfTime;
    const halfDist = arcLength / 2;
    const midVelocity = shipAcceleration * halfTime;
    distanceAlongCurve = halfDist + midVelocity * t2 - 0.5 * shipAcceleration * t2 * t2;
  }

  // Convert distance along curve to Bézier parameter (0–1)
  const bezierT = distanceToParameter(P0, P1, P2, distanceAlongCurve, arcLength);

  // Evaluate Bézier
  return evaluateBezier(P0, P1, P2, bezierT);
}
```

### The distanceToParameter Helper

This converts "distance along the curve" to the Bézier t parameter (0–1). Pre-compute a lookup table of cumulative distances at regular t intervals, then binary search or interpolate.

```typescript
function buildArcLengthTable(P0, P1, P2, segments = 50): { t: number; dist: number }[] {
  const table = [{ t: 0, dist: 0 }];
  let totalDist = 0;
  let prevPoint = P0;

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const point = evaluateBezier(P0, P1, P2, t);
    totalDist += distance(prevPoint, point);
    table.push({ t, dist: totalDist });
    prevPoint = point;
  }

  return table;
}

function distanceToParameter(table: ArcLengthTable, targetDist: number): number {
  // Binary search or linear scan the table
  // Interpolate between the two nearest entries
  for (let i = 1; i < table.length; i++) {
    if (table[i].dist >= targetDist) {
      const prev = table[i - 1];
      const curr = table[i];
      const frac = (targetDist - prev.dist) / (curr.dist - prev.dist);
      return prev.t + frac * (curr.t - prev.t);
    }
  }
  return 1; // At or past the end
}
```

### Velocity at Any Point

The velocity direction at any point on the Bézier is the tangent to the curve at that t:

```
B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)
```

The velocity magnitude comes from the acceleration profile (speeding up first half, slowing down second half). If the player redirects again, use this velocity vector as the input for the next route's P1 calculation. This chains perfectly — each redirect produces a new smooth curve that starts tangent to the current trajectory.

### Visual Result

- **From rest:** Route is a straight line. Ship accelerates, flips, decelerates. Clean and simple.
- **Gentle redirect (new target roughly ahead):** Route is a gentle arc. Ship curves smoothly toward new destination. Feels like a course correction.
- **Hard redirect (new target is sideways or behind):** Route is a wide sweeping curve. Ship swings around in a big arc. Visually dramatic. Costs more fuel because the arc is longer.
- **Multiple redirects:** Each one smoothly chains from the current velocity. The trail behind the ship shows the history of curves. Looks beautiful.

### Fuel Cost for Curved Routes

Fuel cost is based on arc length, not straight-line distance. A redirect that produces a wide curve costs more fuel than a straight shot, because the ship travels further. This is physically intuitive — changing direction "wastes" some of your existing velocity and adds distance.

```typescript
const arcLength = approximateArcLength(P0, P1, P2);
const transitTime = 2 * Math.sqrt(arcLength / acceleration);
const fuelCost = fuelConsumptionRate * transitTime;
```

This naturally penalizes hard redirects (long arcs = more fuel) and rewards committed routes (straight lines = minimum fuel). The player feels this through their fuel gauge without needing to understand the math.

## Summary

Every route is a quadratic Bézier curve with an acceleration/deceleration profile along it.

- New route from rest: Bézier degenerates to a straight line (P1 at midpoint).
- New route with velocity: P1 placed along current velocity vector, creating a smooth arc.
- Position at time T: evaluate acceleration profile to get distance, map distance to Bézier parameter, evaluate Bézier.
- Velocity at time T: Bézier tangent gives direction, acceleration profile gives magnitude.
- Redirects chain smoothly: each new route starts tangent to the old one.

The only tuning parameter is `velocityInfluence` — how much the current velocity widens the arc. Start with `speed * transitTime * 0.25` and adjust for feel.

Do NOT cancel velocity and restart from zero. The curve handles everything.

# BUG FIX: Do NOT zero velocity on reroute

## The Problem

When the player right-clicks a new destination mid-transit, the ship's speed is being reset to zero before computing the new route. This is wrong. The ship should carry its current speed into the new route seamlessly.

## What Should Happen

1. Player clicks new destination while ship is in transit.
2. Read the ship's current speed and velocity direction FROM THE CURRENT ROUTE at the current time. The ship already has a velocity — it's the Bézier tangent at the current position, scaled by the acceleration profile. Use it.
3. Use that velocity (direction AND magnitude) to compute P1 of the new Bézier, exactly as described in the route curves document.
4. The ship continues at its current speed, smoothly curving toward the new destination. NO discontinuity in speed. NO zeroing out. The speed at the end of the old route and the start of the new route must be identical.

## What Is Happening (The Bug)

Somewhere in the reroute code, the ship's velocity is being set to zero (or ignored) before the new route is computed. Find where this happens and fix it.

The likely culprit: when creating a new route, the code is treating it as a fresh departure (from-rest case) instead of a mid-transit redirect. Check the route creation function — there's probably a code path that sets initial velocity to Vec2(0,0) or skips reading the current velocity from the active route.

## How To Get Current Velocity From Active Route

```typescript
// The velocity at any point on the current route has two components:

// 1. DIRECTION: tangent of the Bézier at current parameter t
//    B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)
const tangent = bezierTangent(P0, P1, P2, currentT);
const direction = normalize(tangent);

// 2. MAGNITUDE: from the acceleration profile
const halfTime = transitTime / 2;
let speed: number;
if (elapsedTime <= halfTime) {
  // Still accelerating
  speed = acceleration * elapsedTime;
} else {
  // Decelerating
  speed = acceleration * halfTime - acceleration * (elapsedTime - halfTime);
}

// 3. CURRENT VELOCITY = direction × speed
const currentVelocity = { x: direction.x * speed, y: direction.y * speed };

// Pass this into the new route computation as the initial velocity.
// This is what determines P1 of the new Bézier.
// Do NOT set this to zero. Do NOT ignore it.
```

## Verification

After the fix, test this: fly toward a planet, then mid-transit click a different planet roughly 90 degrees away. The ship should swing in a smooth arc, NOT stop and restart. The speed readout in the UI should show NO dip to zero — it should stay continuous through the redirect.

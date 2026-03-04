# StarryEyes — Navigation Refactor: Manual Thrust → Nav Computer

## Summary

Replace the current right-click-to-set-heading manual thrust model with a right-click-to-set-destination nav computer. The ship flies itself to where the player tells it to go. The player is the captain, not the pilot.

## What Changes

**Old behavior:** Right-click sets a heading vector. Player manually controls thrust level. Ship accelerates in that direction until the player intervenes. Player is responsible for aiming, timing burns, orbital insertion — everything.

**New behavior:** Right-click sets a destination. The nav computer computes a route and flies the ship there automatically. The ship accelerates toward the intercept point for roughly the first half, flips, and decelerates for the second half (brachistochrone). The player watches the trajectory line draw on the map and sees fuel cost, ETA, and current velocity update in real time.

## Destination Types

**Right-click on a planet or moon:** Ship computes an intercept to the body's future position (accounting for orbital motion), flies there, and enters "in orbit" state on arrival. Orbit is a logical state — the ship icon circles the body visually at a fixed rate, but no physics simulation runs. The ship is simply "at" that body.

**Right-click on empty space:** Ship computes a direct route to that fixed point and flies there. On arrival, the ship stops (zero velocity). Useful for repositioning, exploring, or parking at a point of interest.

**Right-click on a station (future):** Same as planet, but enters "docked" state on arrival.

## Intercept Computation

For planet/moon destinations, the target is moving. Use an iterative convergence to find the intercept point:

```typescript
function computeIntercept(
  shipPos: Vec2,
  shipVel: Vec2,       // Current velocity (matters for mid-transit redirects)
  targetBody: CelestialBody,
  acceleration: number, // Ship's current max acceleration (thrust / total_mass)
  gameTime: number
): { targetPosition: Vec2; transitTime: number; arrivalTime: number } {
  
  // Start with current planet position as first guess
  let targetPos = keplerPositionAtTime(targetBody.elements, gameTime);
  let transitTime = 0;
  
  for (let i = 0; i < 4; i++) {
    const distance = vec2Distance(shipPos, targetPos);
    // Basic brachistochrone time: accelerate half, decelerate half
    // t = 2 * sqrt(distance / acceleration)
    // TODO: factor in shipVel for mid-transit redirects (reduces/increases time
    // depending on whether current velocity is toward or away from target)
    transitTime = 2 * Math.sqrt(distance / acceleration);
    const arrivalTime = gameTime + transitTime;
    targetPos = keplerPositionAtTime(targetBody.elements, arrivalTime);
  }
  
  return {
    targetPosition: targetPos,
    transitTime,
    arrivalTime: gameTime + transitTime,
  };
}
```

This converges in 3-4 iterations because the ship is fast relative to planetary orbital motion. The correction each pass is smaller than the last.

For fixed-point destinations (empty space), skip the iteration — the target doesn't move, so it's just distance and brachistochrone time directly.

## Route Execution

Once the player right-clicks and the intercept is computed, the ship follows the route automatically:

1. **Compute** the intercept point and total transit time.
2. **Rotate** to face the intercept point (can be instant for now, or a brief visual turn).
3. **Accelerate** at max thrust toward the intercept point for the first half of the transit.
4. **Flip** at the midpoint (the ship icon rotates 180°).
5. **Decelerate** for the second half, arriving at the destination with near-zero velocity.
6. **Arrive.** If destination is a body, enter "in orbit" state. If empty space, enter "idle" state at zero velocity.

During transit, the ship's position is derived from the route math, not from a physics simulation. At time T into the route, position along the acceleration-deceleration profile is:

```
First half (t < transitTime / 2):
  distance_along_path = 0.5 * acceleration * t²

Second half (t >= transitTime / 2):
  t2 = t - transitTime / 2
  distance_along_path = totalDistance / 2 + midpointVelocity * t2 - 0.5 * acceleration * t2²
```

The path itself is a straight line (or gentle curve) from origin to intercept point. At these thrust levels (1-3g), gravity is negligible during transit — the path IS essentially straight. Direction along the line plus distance along the path gives position.

## Mid-Transit Redirect

If the player right-clicks a new destination while in transit:

1. Evaluate the current route at the current time to get **current position and velocity**.
2. Run the intercept computation from that position/velocity to the new destination.
3. Replace the current route with the new route.
4. The fuel cost of the redirect reflects the velocity change — if you were heading away from the new target, it costs more fuel. If heading roughly toward it, it costs less.

The current velocity should influence the transit time estimate in the intercept computation. For the first pass, you can simplify by ignoring it (just use position), but eventually factor in how much of the current velocity is aligned with the new destination vector.

## Ship States

The ship is always in exactly one of these states:

```typescript
type ShipState =
  | { mode: 'docked'; stationId: string }
  | { mode: 'orbit'; bodyId: string }
  | { mode: 'transit'; route: Route }
  | { mode: 'idle'; position: Vec2; velocity: Vec2 };  // Stationary in space (after arriving at empty-space destination)
```

**Docked:** At a station. No rendering of movement. Ship icon at station location.

**Orbit:** Circling a body. Visual only — icon orbits at a fixed visual rate, no physics. Ship is logically "at" that body.

**Transit:** Following a computed route. Position derived from route math. Trajectory line renders on the map. Drive is active (signature implications for detection system later).

**Idle:** Sitting in space at zero velocity. Arrived at an empty-space destination or cancelled a route. Ship just sits there. Player needs to right-click a new destination to go somewhere.

## Fuel Consumption

Fuel cost for a route is based on total delta-v:

```
deltaV = acceleration * transitTime
fuelConsumed = deltaV * shipMass / exhaustVelocity  (Tsiolkovsky, simplified)
```

Or, for the prototype, just use: `fuelConsumed = fuelConsumptionRate * thrustDuration` where thrust duration equals the full transit time (accelerating the entire time — first half forward, second half braking).

Show the fuel cost BEFORE the player commits to the route. After right-click, briefly show: proposed trajectory line, ETA, fuel cost. Then the ship starts flying. (Or require a confirm click — up to you, experiment with what feels better.)

## Trajectory Line

The predictive trajectory line still renders — it's the planned route drawn ahead of the ship. But now it's the nav computer's plan, not a physics prediction. It curves gently toward the intercept point. Behind the ship, the trail still draws showing where it's been.

When the player right-clicks a new destination, the new trajectory line appears immediately, showing the proposed route before the ship starts moving.

## What to Remove

- Remove the heading-setting behavior from right-click.
- Remove manual thrust control (throttle slider / keyboard thrust input).
- Remove the physics integration loop for the player ship (keep Kepler for planets).
- Remove the old predictive trajectory computation (replaced by route rendering).
- Keep the trail rendering — it still draws from the ship's position history.

## What to Keep

- All Kepler orbit math (planets still orbit on Keplerian paths).
- Camera controls (pan, zoom).
- Trail rendering.
- Time compression display (for debugging/tuning).
- All rendering of celestial bodies.

## Things to NOT Worry About Yet

- Gravity during transit (negligible at these thrust levels).
- Multiple route options (fast vs efficient).
- Fuel running out mid-transit.
- Collision with bodies.
- Other ships or contacts.
- The subsystem tree / ship panels.
- Sound.

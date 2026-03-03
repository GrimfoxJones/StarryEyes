import type { ShipState, Vec2 } from './types.ts';
import { vec2 } from './types.ts';

/**
 * Velocity Verlet integration for a thrusting ship under star gravity.
 * Mutates ship.position, ship.velocity, ship.fuel.
 */
export function integrateShipStep(ship: ShipState, dt: number, starMu: number): void {
  const px = ship.position.x;
  const py = ship.position.y;

  // Acceleration = gravity + thrust
  const r2 = px * px + py * py;
  const r = Math.sqrt(r2);
  const gx = -starMu * px / (r2 * r);
  const gy = -starMu * py / (r2 * r);

  const thrust = ship.thrustLevel * ship.maxAcceleration;
  const tx = ship.heading.x * thrust;
  const ty = ship.heading.y * thrust;

  const ax = gx + tx;
  const ay = gy + ty;

  // Velocity Verlet: update position with current velocity + half acceleration
  const newPx = px + ship.velocity.x * dt + 0.5 * ax * dt * dt;
  const newPy = py + ship.velocity.y * dt + 0.5 * ay * dt * dt;

  // Compute new acceleration at new position
  const newR2 = newPx * newPx + newPy * newPy;
  const newR = Math.sqrt(newR2);
  const newGx = -starMu * newPx / (newR2 * newR);
  const newGy = -starMu * newPy / (newR2 * newR);

  const newAx = newGx + tx;
  const newAy = newGy + ty;

  // Update velocity using average of old and new acceleration
  const newVx = ship.velocity.x + 0.5 * (ax + newAx) * dt;
  const newVy = ship.velocity.y + 0.5 * (ay + newAy) * dt;

  ship.position = vec2(newPx, newPy);
  ship.velocity = vec2(newVx, newVy);

  // Consume fuel
  const fuelUsed = ship.fuelConsumptionRate * ship.thrustLevel * dt;
  ship.fuel = Math.max(0, ship.fuel - fuelUsed);

  // Auto-stop thrust if fuel depleted
  if (ship.fuel <= 0) {
    ship.fuel = 0;
    ship.isThrusting = false;
    ship.thrustLevel = 0;
  }
}

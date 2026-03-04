import type { ShipState, Vec2 } from './types.ts';
import { vec2, Vec2Zero } from './types.ts';

/**
 * Velocity Verlet integration for a thrusting ship under gravity.
 * parentPos is the position of the gravity source (Vec2Zero for Sol).
 * Mutates ship.position, ship.velocity, ship.fuel.
 */
export function integrateShipStep(ship: ShipState, dt: number, mu: number, parentPos: Vec2 = Vec2Zero): void {
  // Position relative to gravity source
  const rx = ship.position.x - parentPos.x;
  const ry = ship.position.y - parentPos.y;

  // Acceleration = gravity + thrust
  const r2 = rx * rx + ry * ry;
  const r = Math.sqrt(r2);
  const gx = -mu * rx / (r2 * r);
  const gy = -mu * ry / (r2 * r);

  const thrust = ship.thrustLevel * ship.maxAcceleration;
  const tx = ship.heading.x * thrust;
  const ty = ship.heading.y * thrust;

  const ax = gx + tx;
  const ay = gy + ty;

  // Velocity Verlet: update position with current velocity + half acceleration
  const newPx = ship.position.x + ship.velocity.x * dt + 0.5 * ax * dt * dt;
  const newPy = ship.position.y + ship.velocity.y * dt + 0.5 * ay * dt * dt;

  // Compute new acceleration at new position (relative to gravity source)
  const newRx = newPx - parentPos.x;
  const newRy = newPy - parentPos.y;
  const newR2 = newRx * newRx + newRy * newRy;
  const newR = Math.sqrt(newR2);
  const newGx = -mu * newRx / (newR2 * newR);
  const newGy = -mu * newRy / (newR2 * newR);

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

import type { PlayerCommand, ShipState, CelestialBody, Vec2 } from './types.js';
import { Vec2Zero } from './types.js';
import { computeRoute, brachistochroneFuelCost, transitPositionAtTime } from './nav.js';

/** Duck-typed system context that both GameServer and StarSystem satisfy. */
export interface ISystemContext {
  ships: ShipState[];
  bodies: CelestialBody[];
  gameTime: number;
  timeCompression: number;
  bodyPositionAtTime(bodyId: string, t: number): Vec2;
  bodyVelocityAtTime(bodyId: string, t: number): Vec2;
}

export function processCommand(system: ISystemContext, cmd: PlayerCommand): void {
  switch (cmd.type) {
    case 'SET_DESTINATION': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (!ship) break;

      // If orbiting, inject body velocity so computeRoute sees initial speed
      const savedVelocity = ship.velocity;
      if (ship.mode === 'orbit' && ship.orbitBodyId) {
        ship.velocity = system.bodyVelocityAtTime(ship.orbitBodyId, system.gameTime);
      }

      const route = computeRoute(
        ship,
        cmd.destination,
        system.gameTime,
        system.bodies,
        (bodyId, t) => system.bodyPositionAtTime(bodyId, t),
        cmd.acceleration,
      );

      if (!route) {
        ship.velocity = savedVelocity;
        break;
      }

      const accelRatio = (cmd.acceleration ?? ship.maxAcceleration) / ship.maxAcceleration;
      const scaledFuelRate = ship.fuelConsumptionRate * accelRatio;
      const fuelCost = brachistochroneFuelCost(route.totalTime, scaledFuelRate);
      if (fuelCost > ship.fuel) {
        ship.velocity = savedVelocity;
        break; // insufficient fuel
      }

      ship.route = {
        ...route,
        fuelAtRouteStart: ship.fuel,
        fuelConsumptionRate: scaledFuelRate,
      };
      ship.mode = 'transit';
      ship.orbitBodyId = null;
      break;
    }

    case 'CANCEL_ROUTE': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (!ship) break;

      if (ship.mode === 'transit' && ship.route) {
        // Settle fuel at cancellation time
        const elapsed = system.gameTime - ship.route.startTime;
        ship.fuel = ship.route.fuelAtRouteStart - ship.route.fuelConsumptionRate * elapsed;
        // Carry momentum into drift
        const result = transitPositionAtTime(ship.route, system.gameTime);
        ship.position = result.position;
        ship.velocity = result.velocity;
        ship.route = null;
        ship.mode = 'drift';
        ship.orbitBodyId = null;
      } else if (ship.mode === 'drift') {
        // Full stop (still drift with zero velocity)
        ship.velocity = Vec2Zero;
        ship.mode = 'drift';
      } else {
        // orbit: unchanged
        ship.route = null;
        ship.mode = 'drift';
        ship.orbitBodyId = null;
      }
      break;
    }

    case 'UNDOCK': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (!ship) break;
      if (ship.mode === 'orbit' && ship.orbitBodyId) {
        ship.mode = 'drift';
        ship.velocity = system.bodyVelocityAtTime(ship.orbitBodyId, system.gameTime);
        ship.orbitBodyId = null;
      }
      break;
    }

  }
}

import type { PlayerCommand } from './types.ts';
import { Vec2Zero } from './types.ts';
import type { StarSystem } from './system.ts';
import { computeRoute, brachistochroneFuelCost, transitPositionAtTime } from './nav.ts';

export function processCommand(system: StarSystem, cmd: PlayerCommand): void {
  switch (cmd.type) {
    case 'SET_DESTINATION': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (!ship) break;

      const route = computeRoute(
        ship,
        cmd.destination,
        system.gameTime,
        system.bodies,
        (bodyId, t) => system.bodyPositionAtTime(bodyId, t),
      );
      if (!route) break;

      const fuelCost = brachistochroneFuelCost(route.totalTime, ship.fuelConsumptionRate);
      if (fuelCost > ship.fuel) break; // insufficient fuel

      ship.fuel -= fuelCost;
      ship.route = route;
      ship.mode = 'transit';
      ship.orbitBodyId = null;
      break;
    }

    case 'CANCEL_ROUTE': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (!ship) break;

      if (ship.mode === 'transit' && ship.route) {
        // Carry momentum into drift
        const result = transitPositionAtTime(ship.route, system.gameTime);
        ship.position = result.position;
        ship.velocity = result.velocity;
        ship.route = null;
        ship.mode = 'drift';
        ship.orbitBodyId = null;
      } else if (ship.mode === 'drift') {
        // Full stop
        ship.velocity = Vec2Zero;
        ship.mode = 'idle';
      } else {
        // orbit/idle: unchanged
        ship.route = null;
        ship.mode = 'idle';
        ship.orbitBodyId = null;
      }
      break;
    }

    case 'SET_TIME_COMPRESSION': {
      system.timeCompression = cmd.multiplier;
      break;
    }

    case 'PAUSE': {
      system.paused = true;
      break;
    }

    case 'RESUME': {
      system.paused = false;
      break;
    }
  }
}

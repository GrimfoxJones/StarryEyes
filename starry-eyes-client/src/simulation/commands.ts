import type { PlayerCommand } from './types.ts';
import { vec2Normalize, vec2Sub } from './types.ts';
import type { StarSystem } from './system.ts';
import { stateToElements } from './kepler.ts';
import { getMuForBody } from './soi.ts';
import { STAR_MU, TIME_COMPRESSION_STEPS } from './constants.ts';

export function processCommand(system: StarSystem, cmd: PlayerCommand): void {
  switch (cmd.type) {
    case 'SET_HEADING': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (ship) {
        ship.heading = vec2Normalize(cmd.heading);
      }
      break;
    }

    case 'SET_THRUST': {
      const ship = system.ships.find(s => s.id === cmd.shipId);
      if (!ship) break;

      const level = Math.max(0, Math.min(1, cmd.level));
      const wasThrusting = ship.isThrusting;
      const willThrust = level > 0 && ship.fuel > 0;

      if (!wasThrusting && willThrust) {
        // Coast → Thrust transition
        // If coasting, evaluate coast orbit to get current state vectors
        if (ship.coastOrbit) {
          // Position/velocity already up to date from tick
          ship.coastOrbit = null;
        }
        ship.isThrusting = true;
      } else if (wasThrusting && !willThrust) {
        // Thrust → Coast transition
        // Convert current state vectors to orbital elements in parent body's frame
        const parentPos = system.getBodyPosition(ship.parentBodyId);
        const parentVel = system.getBodyVelocity(ship.parentBodyId);
        const localPos = vec2Sub(ship.position, parentPos);
        const localVel = vec2Sub(ship.velocity, parentVel);
        const mu = getMuForBody(ship.parentBodyId, system.soiTable, STAR_MU);
        ship.coastOrbit = stateToElements(localPos, localVel, mu, system.gameTime);
        ship.isThrusting = false;
      }

      ship.thrustLevel = level;
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

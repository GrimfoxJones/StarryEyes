import type { PlayerCommand, SystemSnapshot, Vec2 } from './simulation/types.ts';
import type { StarSystem } from './simulation/system.ts';

/** Interface that decouples client from simulation. In Phase 2, a WebSocketBridge replaces this. */
export interface ISimulationBridge {
  sendCommand(cmd: PlayerCommand): void;
  getSnapshot(): SystemSnapshot;
  predictTrajectory(shipId: string): Vec2[];
}

/** Phase 1: direct in-process bridge */
export class LocalBridge implements ISimulationBridge {
  constructor(private system: StarSystem) {}

  sendCommand(cmd: PlayerCommand): void {
    this.system.command(cmd);
  }

  getSnapshot(): SystemSnapshot {
    return this.system.snapshot();
  }

  predictTrajectory(shipId: string): Vec2[] {
    return this.system.predictTrajectory(shipId);
  }
}

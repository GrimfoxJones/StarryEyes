import type { PlayerCommand, SystemSnapshot } from '@starryeyes/shared';

/** Interface that decouples client from simulation. */
export interface ISimulationBridge {
  sendCommand(cmd: PlayerCommand): Promise<void>;
  getLatestSnapshot(): SystemSnapshot | null;
  getMyShipId(): string;
  onSnapshot(cb: (s: SystemSnapshot) => void): () => void;
  connect(): Promise<void>;
  disconnect(): void;
}

import type { PlayerCommand, SystemSnapshot, SubsystemCommand } from '@starryeyes/shared';
import type { GateConnectionInfo } from '@starryeyes/shared';

/** Interface that decouples client from simulation. */
export interface ISimulationBridge {
  sendCommand(cmd: PlayerCommand): Promise<void>;
  getLatestSnapshot(): SystemSnapshot | null;
  getMyShipId(): string;
  onSnapshot(cb: (s: SystemSnapshot) => void): () => void;
  connect(): Promise<void>;
  disconnect(): void;
  jumpGate?(targetSystemIndex: number): Promise<void>;
  getGateConnections?(): Promise<GateConnectionInfo[]>;
  currentSystemIndex?: number;
  subscribeSubsystems?(): void;
  unsubscribeSubsystems?(): void;
  sendSubsystemCommand?(cmd: SubsystemCommand): void;
}

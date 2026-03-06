// ── Subsystem Types ──────────────────────────────────────────────────

export type SubsystemStatus = 'OFFLINE' | 'STARTING' | 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'SHUTDOWN';
export type SubsystemCategory = 'propulsion' | 'power' | 'thermal' | 'sensors' | 'cargo' | 'propellant' | 'structural' | 'comms' | 'navigation' | 'life_support';
export type ValueControl = 'simulated' | 'controlled' | 'player';
export type DisplayHint = 'number' | 'gauge' | 'bar' | 'toggle' | 'slider' | 'enum';
export type InterpolationHint = 'linear' | 'exponential' | 'snap';

export interface SystemValue {
  value: number | boolean | string;
  unit?: string;
  precision?: number;
  min?: number;
  max?: number;
  warnThreshold?: number;
  criticalThreshold?: number;
  warnBelow?: number;
  criticalBelow?: number;
  control: ValueControl;
  autoValue?: number;
  displayHint?: DisplayHint;
  interpolation?: InterpolationHint;
}

export interface SubsystemNode {
  id: string;
  name: string;
  category: SubsystemCategory;
  status: SubsystemStatus;
  values: Record<string, SystemValue>;
  children: SubsystemNode[];
}

export interface SubsystemSnapshot {
  gameTime: number;
  root: SubsystemNode;
}

export type SubsystemCommand =
  | { type: 'SET_VALUE'; nodeId: string; key: string; value: number | boolean | string }
  | { type: 'SET_CONTROL_MODE'; nodeId: string; mode: 'AUTO' | 'MANUAL' };

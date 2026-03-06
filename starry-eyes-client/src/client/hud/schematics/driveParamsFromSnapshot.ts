import type { SubsystemSnapshot, SubsystemNode } from '@starryeyes/shared';
import type { DriveParams } from './drive.schematic.ts';
import { defaultDriveParams } from './drive.schematic.ts';

function findNode(root: SubsystemNode, id: string): SubsystemNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function numVal(node: SubsystemNode | null, key: string, fallback: number): number {
  if (!node) return fallback;
  const v = node.values[key];
  return typeof v?.value === 'number' ? v.value : fallback;
}

function ratio(node: SubsystemNode | null, key: string, max: number): number {
  const v = numVal(node, key, 0);
  return max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
}

export function extractDriveParams(snapshot: SubsystemSnapshot | null): DriveParams {
  if (!snapshot) return defaultDriveParams;

  const drive = findNode(snapshot.root, 'drive');
  const tuning = findNode(snapshot.root, 'drive.tuning');

  const throttle = numVal(drive, 'throttle', 0);
  const maxThrust = drive?.values.max_thrust?.value as number ?? 180;
  const thrustFraction = ratio(drive, 'thrust_output', maxThrust);
  const temperature = ratio(drive, 'drive_temperature', 2000);
  const reactionMassRatio = numVal(tuning, 'reaction_mass_ratio', 0.72);
  const nozzleRatio = numVal(tuning, 'magnetic_nozzle_ratio', 0.85);

  return { throttle, thrustFraction, temperature, reactionMassRatio, nozzleRatio };
}

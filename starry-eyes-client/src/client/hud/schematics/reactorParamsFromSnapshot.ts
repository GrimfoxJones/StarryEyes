import type { SubsystemSnapshot, SubsystemNode } from '@starryeyes/shared';
import type { ReactorParams } from './reactor.schematic.ts';
import { defaultReactorParams } from './reactor.schematic.ts';

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

export function extractReactorParams(snapshot: SubsystemSnapshot | null): ReactorParams {
  if (!snapshot) return defaultReactorParams;

  const reactor = findNode(snapshot.root, 'reactor');
  const core = findNode(snapshot.root, 'reactor.core');
  const radiators = findNode(snapshot.root, 'thermal.radiators');

  const maxOutput = reactor?.values.power_output?.max ?? 200;
  const powerLevel = ratio(reactor, 'power_output', maxOutput);

  const maxField = core?.values.confinement_field?.max ?? 12;
  const coilCurrent = ratio(core, 'confinement_field', maxField);

  // plasma_temperature in MK; 180 MK ≈ full burn
  const plasmaTemp = ratio(core, 'plasma_temperature', 180);

  const coolantFlow = numVal(radiators, 'deployment_fraction', 1);

  return { powerLevel, coilCurrent, plasmaTemp, coolantFlow };
}

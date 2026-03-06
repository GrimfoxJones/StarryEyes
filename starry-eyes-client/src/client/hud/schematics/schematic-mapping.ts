import { compartments, type Compartment } from './ship-overview.schematic.ts';
import type { SubsystemNode, SubsystemSnapshot } from '@starryeyes/shared';

// --- SubTab → Compartment/Overlay mapping ---

interface SchematicMapping {
  compartmentIds: string[];
  overlayLayers: string[];
}

const SUBTAB_MAP: Record<string, SchematicMapping> = {
  OVERVIEW:    { compartmentIds: [],                            overlayLayers: [] },
  NAV:         { compartmentIds: ['bridge'],                    overlayLayers: ['data'] },
  DRIVE:       { compartmentIds: ['drive'],                     overlayLayers: ['drive-exhaust'] },
  REACTOR:     { compartmentIds: ['reactor'],                   overlayLayers: ['power'] },
  THERMAL:     { compartmentIds: ['rad-upper', 'rad-lower'],    overlayLayers: ['coolant'] },
  SENSORS:     { compartmentIds: ['sensors'],                   overlayLayers: ['data'] },
  PROPELLANT:  { compartmentIds: ['fuel-upper', 'fuel-lower'],  overlayLayers: ['fuel'] },
  CARGO:       { compartmentIds: ['cargo'],                     overlayLayers: [] },
  COMMS:       { compartmentIds: ['comms'],                     overlayLayers: ['data'] },
  STRUCTURAL:  { compartmentIds: [],                            overlayLayers: [] },
};

const compartmentById = new Map(compartments.map(c => [c.id, c]));

export function getSchematicMapping(subTabId: string): SchematicMapping {
  return SUBTAB_MAP[subTabId] ?? { compartmentIds: [], overlayLayers: [] };
}

export function getCompartmentsForSubTab(subTabId: string): Compartment[] {
  const mapping = getSchematicMapping(subTabId);
  return mapping.compartmentIds
    .map(id => compartmentById.get(id))
    .filter((c): c is Compartment => c != null);
}

// --- Data bindings: schematic compartments query subsystem values ---
// The schematic side owns these bindings. Ship state knows nothing about the UI.

export interface DataBinding {
  nodeId: string;
  valueKey: string;
}

/** Maps a schematic compartment ID to the subsystem node+value it should read. */
const COMPARTMENT_BINDINGS: Record<string, DataBinding> = {
  'fuel-upper': { nodeId: 'propellant.tank_1', valueKey: 'mass_fraction' },
  'fuel-lower': { nodeId: 'propellant.tank_2', valueKey: 'mass_fraction' },
};

function findNode(root: SubsystemNode, id: string): SubsystemNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/** Resolve a compartment's bound value from the subsystem snapshot. */
export function resolveBinding(
  compartmentId: string,
  snapshot: SubsystemSnapshot | null,
  fallback = 1,
): number {
  const binding = COMPARTMENT_BINDINGS[compartmentId];
  if (!binding || !snapshot) return fallback;
  const node = findNode(snapshot.root, binding.nodeId);
  const val = node?.values[binding.valueKey];
  return typeof val?.value === 'number' ? val.value : fallback;
}

/** Get the binding for a compartment, if one exists. */
export function getBinding(compartmentId: string): DataBinding | undefined {
  return COMPARTMENT_BINDINGS[compartmentId];
}

/** Resolve a numeric value from a subsystem node by ID and value key. */
export function resolveNodeValue(
  snapshot: SubsystemSnapshot | null,
  nodeId: string,
  valueKey: string,
  fallback = 0,
): number {
  if (!snapshot) return fallback;
  const node = findNode(snapshot.root, nodeId);
  const val = node?.values[valueKey];
  return typeof val?.value === 'number' ? val.value : fallback;
}

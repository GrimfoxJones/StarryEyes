import { STATION_ARCHETYPE_DEFS } from '@starryeyes/shared';
import type { StationArchetype } from '@starryeyes/shared';

const ARCHETYPE_NAMES: [StationArchetype, string][] = Object.entries(STATION_ARCHETYPE_DEFS)
  .map(([key, def]) => [key as StationArchetype, def.name]);

export function resolveStationArchetype(stationName: string): StationArchetype | null {
  for (const [archetype, label] of ARCHETYPE_NAMES) {
    if (stationName.includes(label)) return archetype;
  }
  return null;
}

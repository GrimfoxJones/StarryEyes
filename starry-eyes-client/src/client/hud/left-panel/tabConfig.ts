import type { PrimaryTab } from '../store.ts';

export interface SubTabDef {
  id: string;
  label: string;
  description: string;
}

export interface TabDef {
  id: PrimaryTab;
  label: string;
  subTabs: SubTabDef[];
}

export const TABS: TabDef[] = [
  {
    id: 'OPS',
    label: 'OPS',
    subTabs: [
      { id: 'OVERVIEW', label: 'OVERVIEW', description: 'Active operations summary' },
      { id: 'TRADE', label: 'TRADE', description: 'Trade log & transaction history' },
      { id: 'MINING', label: 'MINING', description: 'Mining laser & extraction ops' },
      { id: 'SCAN', label: 'SCAN', description: 'Asteroid & body scanning' },
      { id: 'PROBES', label: 'PROBES', description: 'Deployed probes & telemetry' },
      { id: 'MISSIONS', label: 'MISSIONS', description: 'Active mission log & objectives' },
      { id: 'COMMS', label: 'COMMS', description: 'Communications & station link' },
    ],
  },
  {
    id: 'CREW',
    label: 'CREW',
    subTabs: [
      { id: 'ROSTER', label: 'ROSTER', description: 'Crew roster & assignments' },
      { id: 'DUTY', label: 'DUTY', description: 'Duty schedule & watch rotation' },
      { id: 'MEDICAL', label: 'MEDICAL', description: 'Crew medical status & injuries' },
      { id: 'MORALE', label: 'MORALE', description: 'Crew morale & fatigue levels' },
      { id: 'SKILLS', label: 'SKILLS', description: 'Crew skill specializations' },
    ],
  },
  {
    id: 'DOCK',
    label: 'DOCK',
    subTabs: [
      { id: 'OVERVIEW', label: 'OVERVIEW', description: 'Station info & services' },
      { id: 'MARKET', label: 'MARKET', description: 'Station commodity market' },
      { id: 'REFUEL', label: 'REFUEL', description: 'Propellant & reactor fuel' },
      { id: 'REPAIR', label: 'REPAIR', description: 'Hull & systems repair bay' },
      { id: 'CREW_HIRE', label: 'HIRE', description: 'Recruit new crew members' },
    ],
  },
  {
    id: 'SYS',
    label: 'SYS',
    subTabs: [
      { id: 'OVERVIEW', label: 'OVERVIEW', description: 'Ship systems status dashboard' },
      { id: 'NAV', label: 'NAV', description: 'Navigation computer & waypoints' },
      { id: 'DRIVE', label: 'DRIVE', description: 'Main drive status & thrust control' },
      { id: 'REACTOR', label: 'REACTOR', description: 'Reactor output & fuel consumption' },
      { id: 'THERMAL', label: 'THERMAL', description: 'Heat management & radiators' },
      { id: 'SENSORS', label: 'SENSORS', description: 'Sensor array & contact tracking' },
      { id: 'PROPELLANT', label: 'FUEL', description: 'Fuel tanks & reserves' },
      { id: 'CARGO', label: 'CARGO', description: 'Cargo hold manifest & capacity' },
      { id: 'COMMS', label: 'COMMS', description: 'Communications & transponder' },
      { id: 'STRUCTURAL', label: 'STRUCT.', description: 'Hull integrity & damage control' },
    ],
  },
];

export const TAB_DEFAULTS: Record<PrimaryTab, string> = {
  SYS: 'OVERVIEW',
  CREW: 'ROSTER',
  OPS: 'OVERVIEW',
  DOCK: 'OVERVIEW',
};

export function getTabDef(tabId: PrimaryTab): TabDef {
  return TABS.find((t) => t.id === tabId)!;
}

export function getSubTabDef(tabId: PrimaryTab, subTabId: string): SubTabDef | undefined {
  return getTabDef(tabId).subTabs.find((s) => s.id === subTabId);
}

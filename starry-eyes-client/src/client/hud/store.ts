import { create } from 'zustand';
import type { SystemSnapshot, Destination, SubsystemSnapshot, MarketListing, CargoManifest } from '@starryeyes/shared';
import type { GateConnectionInfo } from '@starryeyes/shared';
import type { ISimulationBridge } from '../../bridge.ts';
import { TAB_DEFAULTS } from './left-panel/tabConfig.ts';

export type PrimaryTab = 'SYS' | 'CREW' | 'OPS' | 'DOCK';
export type ObjectType = 'star' | 'planet' | 'moon' | 'asteroid' | 'gate' | 'ship';

export interface PopupState {
  objectId: string;
  objectType: ObjectType;
  screenX: number;
  screenY: number;
}

export interface ModalState {
  objectId: string;
  objectType: ObjectType;
}

export interface TravelDialogState {
  destination: Destination;
  targetName: string;
  accelerationG: number;
}

export interface GateDialogState {
  gateBodyId: string;
  connections: GateConnectionInfo[];
}

interface GameState {
  // Simulation
  snapshot: SystemSnapshot | null;
  update: (snapshot: SystemSnapshot) => void;

  // Bridge ref
  bridge: ISimulationBridge | null;
  setBridge: (bridge: ISimulationBridge) => void;

  // Left panel
  leftPanelOpen: boolean;
  activeTab: PrimaryTab;
  activeSubTab: string;
  isDocked: boolean;
  setIsDocked: (docked: boolean) => void;
  toggleLeftPanel: () => void;
  openLeftPanel: () => void;
  closeLeftPanel: () => void;
  setActiveTab: (tab: PrimaryTab) => void;
  setActiveSubTab: (subTab: string) => void;
  sysDrillNodeId: string | null;
  setSysDrillNodeId: (nodeId: string | null) => void;
  hoveredSubTab: string | null;
  setHoveredSubTab: (subTab: string | null) => void;

  // Popups
  popup: PopupState | null;
  showPopup: (popup: PopupState) => void;
  dismissPopup: () => void;

  // Modals
  modal: ModalState | null;
  showModal: (modal: ModalState) => void;
  dismissModal: () => void;

  // Travel dialog
  travelDialog: TravelDialogState | null;
  showTravelDialog: (state: TravelDialogState) => void;
  dismissTravelDialog: () => void;
  setTravelAcceleration: (g: number) => void;

  // Gate dialog
  gateDialog: GateDialogState | null;
  showGateDialog: (gateBodyId: string, connections: GateConnectionInfo[]) => void;
  dismissGateDialog: () => void;

  // Debug panel
  debugPanelOpen: boolean;
  toggleDebugPanel: () => void;
  worldSeed: number | null;
  setWorldSeed: (seed: number) => void;
  currentSystemIndex: number;
  setCurrentSystemIndex: (index: number) => void;
  connectedSystems: GateConnectionInfo[];
  setConnectedSystems: (systems: GateConnectionInfo[]) => void;

  // Subsystem state
  subsystemSnapshot: SubsystemSnapshot | null;
  prevSubsystemSnapshot: SubsystemSnapshot | null;
  subsystemReceiveTime: number;
  updateSubsystems: (snapshot: SubsystemSnapshot) => void;

  // Market & cargo state
  marketListings: MarketListing[] | null;
  setMarketListings: (listings: MarketListing[]) => void;
  clearMarketListings: () => void;
  cargoManifest: CargoManifest | null;
  cargoMass: number;
  maxCargo: number;
  credits: number;
  costBasis: Partial<Record<string, number>>;
  setCargoManifest: (cargo: CargoManifest, cargoMass: number, maxCargo: number, credits?: number, costBasis?: Partial<Record<string, number>>) => void;
}

export const useGameStore = create<GameState>((set) => ({
  // Simulation
  snapshot: null,
  update: (snapshot) => set({ snapshot }),

  // Bridge ref
  bridge: null,
  setBridge: (bridge) => set({ bridge }),

  // Left panel
  leftPanelOpen: false,
  activeTab: 'OPS',
  activeSubTab: 'OVERVIEW',
  isDocked: false,
  setIsDocked: (docked) => set((s) => {
    const updates: Partial<GameState> = { isDocked: docked };
    if (!docked && s.activeTab === 'DOCK') {
      updates.activeTab = 'OPS';
      updates.activeSubTab = TAB_DEFAULTS['OPS'];
    }
    return updates;
  }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  openLeftPanel: () => set({ leftPanelOpen: true }),
  closeLeftPanel: () => set({ leftPanelOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab, activeSubTab: TAB_DEFAULTS[tab], sysDrillNodeId: null }),
  setActiveSubTab: (subTab) => set({ activeSubTab: subTab, sysDrillNodeId: null }),
  sysDrillNodeId: null,
  setSysDrillNodeId: (nodeId) => set({ sysDrillNodeId: nodeId }),
  hoveredSubTab: null,
  setHoveredSubTab: (subTab) => set({ hoveredSubTab: subTab }),

  // Popups
  popup: null,
  showPopup: (popup) => set({ popup }),
  dismissPopup: () => set({ popup: null }),

  // Modals
  modal: null,
  showModal: (modal) => set({ modal, popup: null }),
  dismissModal: () => set({ modal: null }),

  // Travel dialog
  travelDialog: null,
  showTravelDialog: (state) => set({ travelDialog: state }),
  dismissTravelDialog: () => set({ travelDialog: null }),
  setTravelAcceleration: (g) => set((s) => s.travelDialog ? { travelDialog: { ...s.travelDialog, accelerationG: g } } : {}),

  // Gate dialog
  gateDialog: null,
  showGateDialog: (gateBodyId, connections) => set({ gateDialog: { gateBodyId, connections } }),
  dismissGateDialog: () => set({ gateDialog: null }),

  // Debug panel
  debugPanelOpen: false,
  toggleDebugPanel: () => set((s) => ({ debugPanelOpen: !s.debugPanelOpen })),
  worldSeed: null,
  setWorldSeed: (seed) => set({ worldSeed: seed }),
  currentSystemIndex: 0,
  setCurrentSystemIndex: (index) => set({ currentSystemIndex: index }),
  connectedSystems: [],
  setConnectedSystems: (systems) => set({ connectedSystems: systems }),

  // Subsystem state
  subsystemSnapshot: null,
  prevSubsystemSnapshot: null,
  subsystemReceiveTime: 0,
  updateSubsystems: (snapshot) => set((s) => ({
    prevSubsystemSnapshot: s.subsystemSnapshot,
    subsystemSnapshot: snapshot,
    subsystemReceiveTime: performance.now(),
  })),

  // Market & cargo state
  marketListings: null,
  setMarketListings: (listings) => set({ marketListings: listings }),
  clearMarketListings: () => set({ marketListings: null }),
  cargoManifest: null,
  cargoMass: 0,
  maxCargo: 40000,
  credits: 0,
  costBasis: {},
  setCargoManifest: (cargo, cargoMass, maxCargo, credits, costBasis) => set({
    cargoManifest: cargo,
    cargoMass,
    maxCargo,
    ...(credits !== undefined ? { credits } : {}),
    ...(costBasis !== undefined ? { costBasis } : {}),
  }),
}));

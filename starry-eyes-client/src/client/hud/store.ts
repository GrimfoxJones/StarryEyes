import { create } from 'zustand';
import type { SystemSnapshot, Destination, SubsystemSnapshot } from '@starryeyes/shared';
import type { GateConnectionInfo } from '@starryeyes/shared';
import type { ISimulationBridge } from '../../bridge.ts';
import { TAB_DEFAULTS } from './left-panel/tabConfig.ts';

export type PrimaryTab = 'SYS' | 'CREW' | 'OPS' | 'DOCK';
export type ObjectType = 'star' | 'planet' | 'moon' | 'asteroid' | 'station' | 'gate' | 'ship';

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
  toggleLeftPanel: () => void;
  openLeftPanel: () => void;
  closeLeftPanel: () => void;
  setActiveTab: (tab: PrimaryTab) => void;
  setActiveSubTab: (subTab: string) => void;

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

  // Subsystem state
  subsystemSnapshot: SubsystemSnapshot | null;
  prevSubsystemSnapshot: SubsystemSnapshot | null;
  subsystemReceiveTime: number;
  updateSubsystems: (snapshot: SubsystemSnapshot) => void;
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
  activeTab: 'SYS',
  activeSubTab: 'OVERVIEW',
  isDocked: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  openLeftPanel: () => set({ leftPanelOpen: true }),
  closeLeftPanel: () => set({ leftPanelOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab, activeSubTab: TAB_DEFAULTS[tab] }),
  setActiveSubTab: (subTab) => set({ activeSubTab: subTab }),

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

  // Subsystem state
  subsystemSnapshot: null,
  prevSubsystemSnapshot: null,
  subsystemReceiveTime: 0,
  updateSubsystems: (snapshot) => set((s) => ({
    prevSubsystemSnapshot: s.subsystemSnapshot,
    subsystemSnapshot: snapshot,
    subsystemReceiveTime: performance.now(),
  })),
}));

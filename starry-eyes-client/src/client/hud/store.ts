import { create } from 'zustand';
import type { SystemSnapshot } from '../../simulation/types.ts';
import { TAB_DEFAULTS } from './left-panel/tabConfig.ts';

export type PrimaryTab = 'SYS' | 'CREW' | 'OPS' | 'DOCK';
export type ObjectType = 'planet' | 'moon' | 'asteroid' | 'station' | 'ship';

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

interface GameState {
  // Simulation
  snapshot: SystemSnapshot | null;
  update: (snapshot: SystemSnapshot) => void;

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
}

export const useGameStore = create<GameState>((set) => ({
  // Simulation
  snapshot: null,
  update: (snapshot) => set({ snapshot }),

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
}));

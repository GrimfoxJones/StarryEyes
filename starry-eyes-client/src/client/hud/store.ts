import { create } from 'zustand';
import type { SystemSnapshot } from '../../simulation/types.ts';

interface GameState {
  snapshot: SystemSnapshot | null;
  update: (snapshot: SystemSnapshot) => void;
}

export const useGameStore = create<GameState>((set) => ({
  snapshot: null,
  update: (snapshot) => set({ snapshot }),
}));

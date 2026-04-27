import { create } from 'zustand';
import type { DiagramState } from '../models/diagram';
import { MAX_HISTORY } from '../constants/defaults';

interface HistoryState {
  past: DiagramState[];
  future: DiagramState[];
  maxSize: number;
}

interface HistoryActions {
  push: (state: DiagramState) => void;
  undo: () => DiagramState | null;
  redo: () => DiagramState | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export type HistoryStore = HistoryState & HistoryActions;

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],
  maxSize: MAX_HISTORY,

  push: (state) =>
    set((prev) => {
      const nextPast = [...prev.past, state];
      if (nextPast.length > prev.maxSize) {
        nextPast.shift();
      }
      return { past: nextPast, future: [] };
    }),

  undo: () => {
    const { past, future } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    set({ past: newPast, future: [previous, ...future] });
    return previous;
  },

  redo: () => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    const newFuture = future.slice(1);
    set({ past: [...past, next], future: newFuture });
    return next;
  },

  canUndo: () => get().past.length > 0,

  canRedo: () => get().future.length > 0,

  clear: () => set({ past: [], future: [] }),
}));

export default useHistoryStore;

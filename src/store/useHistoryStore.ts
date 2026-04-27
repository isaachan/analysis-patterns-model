import { create } from 'zustand';

const MAX_HISTORY_SIZE = 100;

interface HistoryState {
  past: unknown[];
  future: unknown[];

  push: (state: unknown) => void;
  /** Save currentState to future, then pop and return the previous state from past. */
  undo: (currentState: unknown) => unknown | null;
  /** Save currentState to past, then pop and return the next state from future. */
  redo: (currentState: unknown) => unknown | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],

  push: (state) =>
    set((prev) => {
      const newPast = [...prev.past, state];
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift();
      }
      return { past: newPast, future: [] };
    }),

  undo: (currentState) => {
    const { past, future } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set({
      past: past.slice(0, -1),
      future: [currentState, ...future],
    });
    return previous;
  },

  redo: (currentState) => {
    const { past, future } = get();
    if (future.length === 0) return null;
    const next = future[0];
    set({
      past: [...past, currentState],
      future: future.slice(1),
    });
    return next;
  },

  canUndo: () => get().past.length > 0,

  canRedo: () => get().future.length > 0,
}));

export default useHistoryStore;

import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from '../store/useHistoryStore';
import type { DiagramState } from '../models/diagram';
import { MAX_HISTORY } from '../constants/defaults';

/* ------------------------------------------------------------------ */
/*  Helper to create a minimal DiagramState snapshot                   */
/* ------------------------------------------------------------------ */

function makeState(id: number): DiagramState {
  return {
    version: '1.0.0',
    metadata: {
      title: `Diagram ${id}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    elements: [{ id: `el-${id}`, type: 'type', name: `Type${id}`, attributes: [], methods: [], layout: { x: 0, y: 0, width: 180, height: 60 } }],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useHistoryStore', () => {
  beforeEach(() => {
    // Reset the store to initial state before each test
    useHistoryStore.setState({ past: [], future: [] });
  });

  /* ------------------------------------------------------------------ */
  /*  push                                                               */
  /* ------------------------------------------------------------------ */

  describe('push', () => {
    it('adds a state snapshot to the past stack', () => {
      const store = useHistoryStore.getState();
      store.push(makeState(1));

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.past[0].metadata.title).toBe('Diagram 1');
    });

    it('clears the future stack when pushing a new state', () => {
      const store = useHistoryStore.getState();
      // Manually seed future to simulate an undone state
      useHistoryStore.setState({ future: [makeState(0)] });

      store.push(makeState(2));

      const state = useHistoryStore.getState();
      expect(state.future).toHaveLength(0);
      expect(state.past).toHaveLength(1);
    });

    it('accumulates multiple pushes in order', () => {
      for (let i = 1; i <= 5; i++) {
        useHistoryStore.getState().push(makeState(i));
      }

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(5);
      expect(state.past[0].metadata.title).toBe('Diagram 1');
      expect(state.past[4].metadata.title).toBe('Diagram 5');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  undo                                                               */
  /* ------------------------------------------------------------------ */

  describe('undo', () => {
    it('returns the most recent past state and moves it to future', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().push(makeState(2));
      useHistoryStore.getState().push(makeState(3));

      const result = useHistoryStore.getState().undo();

      expect(result).not.toBeNull();
      expect(result!.metadata.title).toBe('Diagram 3');

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(2);
      expect(state.future).toHaveLength(1);
      expect(state.future[0].metadata.title).toBe('Diagram 3');
    });

    it('returns null when past stack is empty', () => {
      const result = useHistoryStore.getState().undo();
      expect(result).toBeNull();
    });

    it('returns null when past stack is empty even if future has entries', () => {
      // Seed future but not past
      useHistoryStore.setState({ past: [], future: [makeState(0)] });
      const result = useHistoryStore.getState().undo();
      expect(result).toBeNull();
    });

    it('does not modify future when undo returns null', () => {
      const futureBefore = useHistoryStore.getState().future;
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().future).toEqual(futureBefore);
    });

    it('returns previous state after multiple undos', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().push(makeState(2));
      useHistoryStore.getState().push(makeState(3));

      // First undo returns state 3
      const result1 = useHistoryStore.getState().undo();
      expect(result1!.metadata.title).toBe('Diagram 3');

      // Second undo returns state 2
      const result2 = useHistoryStore.getState().undo();
      expect(result2!.metadata.title).toBe('Diagram 2');

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(1);
      expect(state.future).toHaveLength(2);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  redo                                                               */
  /* ------------------------------------------------------------------ */

  describe('redo', () => {
    it('returns the most recent future state and moves it to past', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().push(makeState(2));
      useHistoryStore.getState().undo(); // Push 2 -> future

      const result = useHistoryStore.getState().redo();

      expect(result).not.toBeNull();
      expect(result!.metadata.title).toBe('Diagram 2');

      const state = useHistoryStore.getState();
      expect(state.future).toHaveLength(0);
      expect(state.past).toHaveLength(2);
    });

    it('returns null when future stack is empty', () => {
      const result = useHistoryStore.getState().redo();
      expect(result).toBeNull();
    });

    it('allows redo after undo then redo works in sequence', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().push(makeState(2));

      useHistoryStore.getState().undo(); // -> state 2 in future
      useHistoryStore.getState().undo(); // -> state 1 in future

      const r1 = useHistoryStore.getState().redo();
      expect(r1!.metadata.title).toBe('Diagram 1');

      const r2 = useHistoryStore.getState().redo();
      expect(r2!.metadata.title).toBe('Diagram 2');

      // Future should be empty now
      expect(useHistoryStore.getState().future).toHaveLength(0);
    });

    it('returns null when redoing past the latest state', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().undo(); // state 1 -> future
      useHistoryStore.getState().redo(); // state 1 -> past

      // Another redo should return null
      const result = useHistoryStore.getState().redo();
      expect(result).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  canUndo / canRedo                                                  */
  /* ------------------------------------------------------------------ */

  describe('canUndo', () => {
    it('returns false when past stack is empty', () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);
    });

    it('returns true when past stack has entries', () => {
      useHistoryStore.getState().push(makeState(1));
      expect(useHistoryStore.getState().canUndo()).toBe(true);
    });
  });

  describe('canRedo', () => {
    it('returns false when future stack is empty', () => {
      expect(useHistoryStore.getState().canRedo()).toBe(false);
    });

    it('returns true when future stack has entries (after undo)', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clear                                                              */
  /* ------------------------------------------------------------------ */

  describe('clear', () => {
    it('empties both past and future stacks', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().push(makeState(2));
      useHistoryStore.getState().undo(); // creates future entry

      expect(useHistoryStore.getState().past.length).toBeGreaterThan(0);
      expect(useHistoryStore.getState().future.length).toBeGreaterThan(0);

      useHistoryStore.getState().clear();

      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
    });

    it('clear on empty store is a no-op (no error)', () => {
      expect(() => useHistoryStore.getState().clear()).not.toThrow();
      const state = useHistoryStore.getState();
      expect(state.past).toHaveLength(0);
      expect(state.future).toHaveLength(0);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  History bound (MAX_HISTORY = 100)                                  */
  /* ------------------------------------------------------------------ */

  describe('history bound (MAX_HISTORY)', () => {
    it('drops the oldest entry when exceeding MAX_HISTORY', () => {
      // Push MAX_HISTORY + 1 entries
      for (let i = 0; i < MAX_HISTORY + 5; i++) {
        useHistoryStore.getState().push(makeState(i));
      }

      const state = useHistoryStore.getState();
      // past should be bounded at maxSize = MAX_HISTORY
      expect(state.past.length).toBeLessThanOrEqual(MAX_HISTORY);

      // The oldest entries (0..4) should have been shifted out
      const oldest = state.past[0];
      expect(oldest.metadata.title).toBe(`Diagram ${5}`);
    });

    it('preserves the most recent MAX_HISTORY entries', () => {
      for (let i = 0; i < MAX_HISTORY + 10; i++) {
        useHistoryStore.getState().push(makeState(i));
      }

      const state = useHistoryStore.getState();
      expect(state.past.length).toBe(MAX_HISTORY);

      // The most recent entry should be Diagram 109
      const newest = state.past[state.past.length - 1];
      expect(newest.metadata.title).toBe(`Diagram ${MAX_HISTORY + 9}`);

      // The oldest should be Diagram 10
      const oldest = state.past[0];
      expect(oldest.metadata.title).toBe(`Diagram ${10}`);
    });

    it('less than MAX_HISTORY entries are all preserved', () => {
      for (let i = 0; i < 50; i++) {
        useHistoryStore.getState().push(makeState(i));
      }

      const state = useHistoryStore.getState();
      expect(state.past.length).toBe(50);
      expect(state.past[0].metadata.title).toBe('Diagram 0');
      expect(state.past[49].metadata.title).toBe('Diagram 49');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Push clears future (integrated behavior)                           */
  /* ------------------------------------------------------------------ */

  describe('push clears future', () => {
    it('new push after undo resets future and starts fresh branch', () => {
      useHistoryStore.getState().push(makeState(1));
      useHistoryStore.getState().push(makeState(2));
      useHistoryStore.getState().undo(); // state 2 -> future

      // Future has 1 entry, past has 1 entry
      expect(useHistoryStore.getState().future).toHaveLength(1);
      expect(useHistoryStore.getState().past).toHaveLength(1);

      // New push
      useHistoryStore.getState().push(makeState(3));

      // Future should be cleared, past should have 2 entries (state 1 + state 3)
      const state = useHistoryStore.getState();
      expect(state.future).toHaveLength(0);
      expect(state.past).toHaveLength(2);
      expect(state.past[1].metadata.title).toBe('Diagram 3');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  setElements not pushing (undo/redo safety)                         */
  /* ------------------------------------------------------------------ */

  describe('setElements does not push to history', () => {
    it('setElements from undo/redo bypasses push', () => {
      // Verify that the diagramStore's setElements behavior is correct:
      // when history returns a state, the consumer calls setElements which
      // should NOT push. This is tested in useDiagramStore.test.tsx.
      // The history store itself doesn't have setElements — it just
      // manages past/future stacks.
    });
  });
});

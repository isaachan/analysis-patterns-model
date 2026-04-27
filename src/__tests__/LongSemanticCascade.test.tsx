import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiagramElement, DiagramState, LongSemanticElement } from '../models/diagram';
import { DEFAULT_NOTE_WIDTH, NOTE_MIN_HEIGHT } from '../constants/defaults';

/* ------------------------------------------------------------------ */
/*  Mock the history store                                             */
/* ------------------------------------------------------------------ */

const mockHistoryState = vi.hoisted(() => ({
  past: [] as DiagramState[],
  future: [] as DiagramState[],
  push: vi.fn(),
  undo: vi.fn(() => null),
  redo: vi.fn(() => null),
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
  clear: vi.fn(),
}));

vi.mock('../store/useHistoryStore', () => ({
  useHistoryStore: Object.assign(
    vi.fn(() => mockHistoryState),
    { getState: vi.fn(() => mockHistoryState) },
  ),
}));

// Must import after mocks are set up
import { useDiagramStore } from '../store/useDiagramStore';

/* ------------------------------------------------------------------ */
/*  Sample elements                                                    */
/* ------------------------------------------------------------------ */

const sampleType: DiagramElement = {
  id: 'type-1',
  type: 'type',
  name: 'Customer',
  attributes: [],
  methods: [],
  layout: { x: 100, y: 150, width: 180, height: 60 },
};

const sampleType2: DiagramElement = {
  id: 'type-2',
  type: 'type',
  name: 'Order',
  attributes: [],
  methods: [],
  layout: { x: 400, y: 150, width: 180, height: 60 },
};

const attachedNote: LongSemanticElement = {
  id: 'longsem-attached',
  type: 'longSemantic',
  heading: 'note',
  body: 'Attached semantic note.',
  attachedTo: 'type-1',
  layout: { x: 100, y: 234, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
};

const freeNote: LongSemanticElement = {
  id: 'longsem-free',
  type: 'longSemantic',
  heading: 'note',
  body: 'Free-floating note.',
  layout: { x: 300, y: 300, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
};

/* ================================================================== */
/*  ME-39: Cascade tests                                               */
/* ================================================================== */

describe('ME-39: Cascade delete detaches LongSemanticElement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.getState().clearAll();
  });

  /* ------------------------------------------------------------------ */
  /*  deleteElement tests                                                */
  /* ------------------------------------------------------------------ */

  describe('deleteElement', () => {
    it('detaches a LongSemanticElement when its attached Type is deleted', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      expect(useDiagramStore.getState().elements).toHaveLength(2);

      useDiagramStore.getState().deleteElement('type-1');

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      const note = remaining[0] as LongSemanticElement;
      expect(note.type).toBe('longSemantic');
      expect(note.attachedTo).toBeUndefined();
    });

    it('does not affect free-floating LongSemanticElements when a Type is deleted', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(freeNote);

      useDiagramStore.getState().deleteElement('type-1');

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      const note = remaining[0] as LongSemanticElement;
      expect(note.id).toBe('longsem-free');
      expect(note.attachedTo).toBeUndefined(); // was already free
    });

    it('deletes a free-floating LongSemanticElement when directly deleted', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(freeNote);

      useDiagramStore.getState().deleteElement('longsem-free');

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('type-1');
    });

    it('deletes an attached LongSemanticElement when directly deleted', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      useDiagramStore.getState().deleteElement('longsem-attached');

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('type-1');
    });

    it('preserves the layout position of a detached LongSemanticElement', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      const originalLayout = { ...attachedNote.layout };

      useDiagramStore.getState().deleteElement('type-1');

      const remaining = useDiagramStore.getState().elements;
      const note = remaining[0] as LongSemanticElement;
      expect(note.layout).toEqual(originalLayout);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteSelectedElements tests                                       */
  /* ------------------------------------------------------------------ */

  describe('deleteSelectedElements', () => {
    it('detaches a LongSemanticElement when its attached Type is deleted', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      expect(useDiagramStore.getState().elements).toHaveLength(2);

      useDiagramStore.getState().deleteSelectedElements(['type-1']);

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      const note = remaining[0] as LongSemanticElement;
      expect(note.type).toBe('longSemantic');
      expect(note.attachedTo).toBeUndefined();
    });

    it('does not affect free-floating LongSemanticElements when Type is deleted', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(freeNote);

      useDiagramStore.getState().deleteSelectedElements(['type-1']);

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('longsem-free');
    });

    it('only detaches the correct note when multiple notes exist', () => {
      const attachedNote2: LongSemanticElement = {
        id: 'longsem-attached-2',
        type: 'longSemantic',
        heading: 'note',
        body: 'Another attached note.',
        attachedTo: 'type-2',
        layout: { x: 10, y: 10, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
      };

      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      useDiagramStore.getState().addElement(attachedNote);
      useDiagramStore.getState().addElement(attachedNote2);
      useDiagramStore.getState().addElement(freeNote);

      expect(useDiagramStore.getState().elements).toHaveLength(5);

      useDiagramStore.getState().deleteSelectedElements(['type-1']);

      const remaining = useDiagramStore.getState().elements;
      // type-1 is gone + its relations (none), type-2 remains, all notes remain
      expect(remaining).toHaveLength(4);

      // The note attached to type-1 should be detached
      const formerlyAttached = remaining.find(
        (el) => el.id === 'longsem-attached',
      ) as LongSemanticElement;
      expect(formerlyAttached).toBeDefined();
      expect(formerlyAttached.attachedTo).toBeUndefined();

      // The note attached to type-2 should still be attached
      const stillAttached = remaining.find(
        (el) => el.id === 'longsem-attached-2',
      ) as LongSemanticElement;
      expect(stillAttached).toBeDefined();
      expect(stillAttached.attachedTo).toBe('type-2');

      // Free note unchanged
      const stillFree = remaining.find(
        (el) => el.id === 'longsem-free',
      ) as LongSemanticElement;
      expect(stillFree).toBeDefined();
      expect(stillFree.attachedTo).toBeUndefined();
    });

    it('deletes a LongSemanticElement directly when its id is in the delete list', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      useDiagramStore.getState().deleteSelectedElements(['longsem-attached']);

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('type-1');
    });

    it('preserves the layout position of a detached LongSemanticElement', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      const originalLayout = { ...attachedNote.layout };

      useDiagramStore.getState().deleteSelectedElements(['type-1']);

      const remaining = useDiagramStore.getState().elements;
      const note = remaining[0] as LongSemanticElement;
      expect(note.layout).toEqual(originalLayout);
    });

    it('handles empty ids array gracefully', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      useDiagramStore.getState().deleteSelectedElements([]);

      expect(useDiagramStore.getState().elements).toHaveLength(2);
    });

    it('handles non-existent ids gracefully', () => {
      useDiagramStore.getState().addElement(sampleType);

      expect(() => {
        useDiagramStore.getState().deleteSelectedElements(['nonexistent']);
      }).not.toThrow();
      expect(useDiagramStore.getState().elements).toHaveLength(1);
    });

    it('pushes state to history before cascade delete', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);

      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-1']);

      expect(mockHistoryState.push).toHaveBeenCalled();
    });

    it('handles deleting a Type that has multiple attached LongSemanticElements', () => {
      const attachedNote2: LongSemanticElement = {
        id: 'longsem-attached-2',
        type: 'longSemantic',
        heading: 'note',
        body: 'Second attached note to type-1.',
        attachedTo: 'type-1',
        layout: { x: 50, y: 50, width: DEFAULT_NOTE_WIDTH, height: NOTE_MIN_HEIGHT },
      };

      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(attachedNote);
      useDiagramStore.getState().addElement(attachedNote2);

      expect(useDiagramStore.getState().elements).toHaveLength(3);

      useDiagramStore.getState().deleteSelectedElements(['type-1']);

      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(2); // Both notes survive, detached

      for (const el of remaining) {
        const note = el as LongSemanticElement;
        expect(note.attachedTo).toBeUndefined();
      }
    });
  });
});

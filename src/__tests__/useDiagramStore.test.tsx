import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DiagramElement, DiagramState } from '../models/diagram';

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
/*  Test helpers                                                       */
/* ------------------------------------------------------------------ */

const sampleType: DiagramElement = {
  id: 'type-1',
  type: 'type',
  name: 'Customer',
  attributes: [],
  methods: [],
  layout: { x: 100, y: 150, width: 180, height: 110 },
};

const sampleType2: DiagramElement = {
  id: 'type-2',
  type: 'type',
  name: 'Order',
  attributes: [],
  methods: [],
  layout: { x: 400, y: 150, width: 180, height: 110 },
};

const sampleRelation: DiagramElement = {
  id: 'rel-1',
  type: 'relation',
  sourceId: 'type-1',
  targetId: 'type-2',
  sourceCardinality: 'exactly_one',
  targetCardinality: 'zero_or_many',
  label: 'has',
};

const sampleRelation2: DiagramElement = {
  id: 'rel-2',
  type: 'relation',
  sourceId: 'type-2',
  targetId: 'type-1',
  sourceCardinality: 'zero_or_many',
  targetCardinality: 'exactly_one',
  label: 'belongs to',
};

describe('useDiagramStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.getState().clearAll();
  });

  it('starts with empty elements', () => {
    const state = useDiagramStore.getState();
    expect(state.elements).toEqual([]);
  });

  /* ------------------------------------------------------------------ */
  /*  addElement                                                         */
  /* ------------------------------------------------------------------ */

  describe('addElement', () => {
    it('adds an element to the store', () => {
      useDiagramStore.getState().addElement(sampleType);
      expect(useDiagramStore.getState().elements).toHaveLength(1);
      expect(useDiagramStore.getState().elements[0].id).toBe('type-1');
    });

    it('pushes state to history before adding', () => {
      // The beforeEach calls clearAll which pushes. So there is one prior call.
      // After addElement, push is called a second time with the state BEFORE
      // the new element is added.
      useDiagramStore.getState().addElement(sampleType);
      expect(mockHistoryState.push).toHaveBeenCalledTimes(2); // clearAll + addElement
      // The last push should have the state before addElement (empty elements)
      const lastCallIdx = mockHistoryState.push.mock.calls.length - 1;
      const pushedState = mockHistoryState.push.mock.calls[lastCallIdx][0];
      expect(pushedState.elements).toEqual([]);
    });

    it('adds multiple elements in order', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      expect(useDiagramStore.getState().elements).toHaveLength(2);
      expect(useDiagramStore.getState().elements[0].id).toBe('type-1');
      expect(useDiagramStore.getState().elements[1].id).toBe('type-2');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  updateElement                                                      */
  /* ------------------------------------------------------------------ */

  describe('updateElement', () => {
    it('updates an element by id', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().updateElement('type-1', { name: 'UpdatedName' });
      const el = useDiagramStore.getState().elements[0] as typeof sampleType;
      expect(el.name).toBe('UpdatedName');
    });

    it('pushes state to history before updating', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      useDiagramStore.getState().updateElement('type-1', { name: 'Updated' });
      expect(mockHistoryState.push).toHaveBeenCalled();
    });

    it('leaves other elements unchanged', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      vi.clearAllMocks();
      useDiagramStore.getState().updateElement('type-1', { name: 'Updated' });
      const elements = useDiagramStore.getState().elements;
      expect(elements).toHaveLength(2);
      expect((elements[0] as typeof sampleType).name).toBe('Updated');
      expect((elements[1] as typeof sampleType).name).toBe('Order');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteElement                                                      */
  /* ------------------------------------------------------------------ */

  describe('deleteElement', () => {
    it('deletes an element by id', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().deleteElement('type-1');
      expect(useDiagramStore.getState().elements).toHaveLength(0);
    });

    it('pushes state to history before deleting', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteElement('type-1');
      expect(mockHistoryState.push).toHaveBeenCalled();
    });

    it('does not crash when deleting a non-existent id', () => {
      expect(() => {
        useDiagramStore.getState().deleteElement('nonexistent');
      }).not.toThrow();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteSelectedElements                                             */
  /* ------------------------------------------------------------------ */

  describe('deleteSelectedElements', () => {
    it('deletes specified elements by ids', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-1']);
      expect(useDiagramStore.getState().elements).toHaveLength(1);
      expect(useDiagramStore.getState().elements[0].id).toBe('type-2');
    });

    it('pushes state to history before deleting', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-1']);
      expect(mockHistoryState.push).toHaveBeenCalled();
    });

    it('cascades: deleting a Type also deletes connected relations', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      useDiagramStore.getState().addElement(sampleRelation);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-1']);
      const remaining = useDiagramStore.getState().elements;
      // type-2 should remain, type-1 and rel-1 should be gone
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('type-2');
    });

    it('cascades multiple Types: deletes all connected relations', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      useDiagramStore.getState().addElement(sampleRelation);
      useDiagramStore.getState().addElement(sampleRelation2);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-1', 'type-2']);
      expect(useDiagramStore.getState().elements).toHaveLength(0);
    });

    it('does not delete relations when deleting non-Type elements', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      useDiagramStore.getState().addElement(sampleRelation);
      vi.clearAllMocks();
      // Delete only the relation, not the type
      useDiagramStore.getState().deleteSelectedElements(['rel-1']);
      const remaining = useDiagramStore.getState().elements;
      expect(remaining).toHaveLength(2); // Both types remain
      expect(remaining.find((el) => el.id === 'rel-1')).toBeUndefined();
    });

    it('handles empty ids array gracefully', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements([]);
      expect(useDiagramStore.getState().elements).toHaveLength(1);
      expect(mockHistoryState.push).toHaveBeenCalled();
    });

    it('handles non-existent ids gracefully', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      expect(() => {
        useDiagramStore.getState().deleteSelectedElements(['nonexistent']);
      }).not.toThrow();
      expect(useDiagramStore.getState().elements).toHaveLength(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  setElements                                                        */
  /* ------------------------------------------------------------------ */

  describe('setElements', () => {
    it('replaces all elements', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      useDiagramStore.getState().setElements([sampleType2]);
      expect(useDiagramStore.getState().elements).toHaveLength(1);
      expect(useDiagramStore.getState().elements[0].id).toBe('type-2');
    });

    it('does NOT push to history (used for undo/redo)', () => {
      // beforeEach calls clearAll which pushes once. setElements should NOT push.
      const pushCountBefore = mockHistoryState.push.mock.calls.length;
      useDiagramStore.getState().setElements([sampleType]);
      // Should NOT have called push again (same count as before)
      expect(mockHistoryState.push.mock.calls.length).toBe(pushCountBefore);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clearAll                                                           */
  /* ------------------------------------------------------------------ */

  describe('clearAll', () => {
    it('removes all elements', () => {
      useDiagramStore.getState().addElement(sampleType);
      useDiagramStore.getState().addElement(sampleType2);
      vi.clearAllMocks();
      useDiagramStore.getState().clearAll();
      expect(useDiagramStore.getState().elements).toHaveLength(0);
    });

    it('pushes state to history before clearing', () => {
      useDiagramStore.getState().addElement(sampleType);
      vi.clearAllMocks();
      useDiagramStore.getState().clearAll();
      expect(mockHistoryState.push).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-32: Cascade delete — generalization                              */
  /* ------------------------------------------------------------------ */

  describe('ME-32 cascade delete generalization', () => {
    const parentType: DiagramElement = {
      id: 'type-parent',
      type: 'type',
      name: 'Parent',
      attributes: [],
      methods: [],
      layout: { x: 100, y: 100, width: 180, height: 60 },
    };

    const childType: DiagramElement = {
      id: 'child-type',
      type: 'type',
      name: 'Child',
      attributes: [],
      methods: [],
      layout: { x: 200, y: 250, width: 180, height: 60 },
    };

    const genWithParent: DiagramElement = {
      id: 'gen-1',
      type: 'generalization',
      name: 'TestGen',
      childIds: ['child-type'],
      parentId: 'type-parent',
      completeness: 'complete',
      layout: { x: 0, y: 200, width: 220, height: 140 },
    };

    it('deleteElement: deleting a parent Type cascades to delete its generalization containers', () => {
      useDiagramStore.getState().addElement(parentType);
      useDiagramStore.getState().addElement(childType);
      useDiagramStore.getState().addElement(genWithParent);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteElement('type-parent');
      const remaining = useDiagramStore.getState().elements;
      // gen-1 should be cascade deleted (parentId was type-parent)
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('child-type');
    });

    it('deleteElement: deleting generalization container releases child Types', () => {
      useDiagramStore.getState().addElement(parentType);
      useDiagramStore.getState().addElement(childType);
      useDiagramStore.getState().addElement(genWithParent);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteElement('gen-1');
      const remaining = useDiagramStore.getState().elements;
      // Both parentType and childType remain as free elements
      expect(remaining).toHaveLength(2);
      expect(remaining.find((el) => el.id === 'child-type')).toBeDefined();
      expect(remaining.find((el) => el.id === 'type-parent')).toBeDefined();
    });

    it('deleteSelectedElements: deleting a parent Type cascades to delete its generalization containers', () => {
      useDiagramStore.getState().addElement(parentType);
      useDiagramStore.getState().addElement(childType);
      useDiagramStore.getState().addElement(genWithParent);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-parent']);
      const remaining = useDiagramStore.getState().elements;
      // gen-1 should be cascade deleted, childType remains
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('child-type');
    });

    it('deleteSelectedElements: deleting multiple types cascades all generalization containers', () => {
      const gen2: DiagramElement = {
        id: 'gen-2',
        type: 'generalization',
        name: 'TestGen2',
        childIds: [],
        parentId: 'type-parent',
        completeness: 'complete',
        layout: { x: 300, y: 300, width: 220, height: 140 },
      };
      useDiagramStore.getState().addElement(parentType);
      useDiagramStore.getState().addElement(childType);
      useDiagramStore.getState().addElement(genWithParent);
      useDiagramStore.getState().addElement(gen2);
      vi.clearAllMocks();
      useDiagramStore.getState().deleteSelectedElements(['type-parent']);
      const remaining = useDiagramStore.getState().elements;
      expect(remaining.find((el) => el.id === 'gen-1')).toBeUndefined();
      expect(remaining.find((el) => el.id === 'gen-2')).toBeUndefined();
      expect(remaining.find((el) => el.id === 'child-type')).toBeDefined();
    });
  });
});

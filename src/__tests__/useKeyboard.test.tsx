import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { useKeyboard } from '../hooks/useKeyboard';

/* ------------------------------------------------------------------ */
/*  Mock stores                                                        */
/* ------------------------------------------------------------------ */

const historyState = vi.hoisted(() => ({
  past: [] as unknown[],
  future: [] as unknown[],
  push: vi.fn(),
  undo: vi.fn(() => null),
  redo: vi.fn(() => null),
  canUndo: vi.fn(() => false),
  canRedo: vi.fn(() => false),
  clear: vi.fn(),
}));

const diagramState = vi.hoisted(() => ({
  elements: [] as unknown[],
  addElement: vi.fn(),
  updateElement: vi.fn(),
  deleteElement: vi.fn(),
  deleteSelectedElements: vi.fn(),
  setElements: vi.fn(),
  clearAll: vi.fn(),
}));

const editorState = vi.hoisted(() => ({
  currentTool: 'select' as string,
  selectedIds: [] as string[],
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  snapEnabled: true,
  select: vi.fn(),
  deselectAll: vi.fn(),
  setZoom: vi.fn(),
  setPan: vi.fn(),
  setGridEnabled: vi.fn(),
  setSnapEnabled: vi.fn(),
}));

vi.mock('../store/useHistoryStore', () => ({
  useHistoryStore: Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      const state = historyState;
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn(() => historyState) },
  ),
}));

vi.mock('../store/useDiagramStore', () => ({
  useDiagramStore: Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      const state = diagramState;
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn(() => diagramState) },
  ),
}));

vi.mock('../store/useEditorStore', () => ({
  useEditorStore: Object.assign(
    vi.fn((selector?: (state: unknown) => unknown) => {
      const state = editorState;
      return selector ? selector(state) : state;
    }),
    { getState: vi.fn(() => editorState) },
  ),
}));

/* ------------------------------------------------------------------ */
/*  Test helper component                                              */
/* ------------------------------------------------------------------ */

function TestHarness() {
  useKeyboard();
  return <div data-testid="harness" />;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useKeyboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    historyState.undo.mockReturnValue(null);
    historyState.redo.mockReturnValue(null);
    editorState.selectedIds = [];
  });

  it('mounts without crashing', () => {
    const { container } = render(<TestHarness />);
    expect(container).toBeTruthy();
  });

  /* ------------------------------------------------------------------ */
  /*  ME-24/25/26: Undo/redo keyboard shortcuts                         */
  /* ------------------------------------------------------------------ */

  describe('Ctrl+Z undo', () => {
    it('calls undo and setElements when Ctrl+Z is pressed', () => {
      const mockState = { elements: [{ id: 'el1' }] };
      historyState.undo.mockReturnValue(mockState as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      );

      expect(historyState.undo).toHaveBeenCalledOnce();
      expect(diagramState.setElements).toHaveBeenCalledWith(mockState.elements);
    });

    it('does not call setElements when undo returns null', () => {
      historyState.undo.mockReturnValue(null as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }),
      );

      expect(historyState.undo).toHaveBeenCalledOnce();
      expect(diagramState.setElements).not.toHaveBeenCalled();
    });

    it('handles Cmd+Z (Mac) correctly', () => {
      const mockState = { elements: [{ id: 'el1' }] };
      historyState.undo.mockReturnValue(mockState as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }),
      );

      expect(historyState.undo).toHaveBeenCalledOnce();
    });

    it('does not trigger for plain Z without modifier', () => {
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'z', ctrlKey: false, bubbles: true }),
      );

      expect(historyState.undo).not.toHaveBeenCalled();
      expect(diagramState.setElements).not.toHaveBeenCalled();
    });

    it('prefers Ctrl+Shift+Z (redo) over Ctrl+Z when shift is held', () => {
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );

      // Should trigger redo, not undo
      expect(historyState.undo).not.toHaveBeenCalled();
      expect(historyState.redo).toHaveBeenCalledOnce();
    });
  });

  describe('Ctrl+Y redo', () => {
    it('calls redo and setElements when Ctrl+Y is pressed', () => {
      const mockState = { elements: [{ id: 'el1' }] };
      historyState.redo.mockReturnValue(mockState as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }),
      );

      expect(historyState.redo).toHaveBeenCalledOnce();
      expect(diagramState.setElements).toHaveBeenCalledWith(mockState.elements);
    });

    it('handles Cmd+Y (Mac) correctly', () => {
      const mockState = { elements: [{ id: 'el1' }] };
      historyState.redo.mockReturnValue(mockState as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', metaKey: true, bubbles: true }),
      );

      expect(historyState.redo).toHaveBeenCalledOnce();
    });

    it('does not call setElements when redo returns null', () => {
      historyState.redo.mockReturnValue(null as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }),
      );

      expect(historyState.redo).toHaveBeenCalledOnce();
      expect(diagramState.setElements).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+Shift+Z redo (alternative)', () => {
    it('calls redo when Ctrl+Shift+Z is pressed', () => {
      const mockState = { elements: [{ id: 'el1' }] };
      historyState.redo.mockReturnValue(mockState as never);
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'z',
          ctrlKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );

      expect(historyState.redo).toHaveBeenCalledOnce();
      expect(diagramState.setElements).toHaveBeenCalledWith(mockState.elements);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-40: Delete key tests                                            */
  /* ------------------------------------------------------------------ */

  describe('Delete/Backspace key', () => {
    it('calls deleteSelectedElements with selectedIds on Delete key', () => {
      editorState.selectedIds = ['type-1', 'rel-1'];
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
      );

      expect(diagramState.deleteSelectedElements).toHaveBeenCalledWith([
        'type-1',
        'rel-1',
      ]);
    });

    it('calls deleteSelectedElements with selectedIds on Backspace key', () => {
      editorState.selectedIds = ['type-1'];
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
      );

      expect(diagramState.deleteSelectedElements).toHaveBeenCalledWith(['type-1']);
    });

    it('does NOT call deleteSelectedElements when nothing is selected', () => {
      editorState.selectedIds = [];
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }),
      );

      expect(diagramState.deleteSelectedElements).not.toHaveBeenCalled();
    });

    it('does NOT call deleteSelectedElements for non-delete keys', () => {
      editorState.selectedIds = ['type-1'];
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'a', bubbles: true }),
      );

      expect(diagramState.deleteSelectedElements).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Escape key test                                                    */
  /* ------------------------------------------------------------------ */

  describe('Escape key', () => {
    it('calls deselectAll on Escape key', () => {
      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );

      expect(editorState.deselectAll).toHaveBeenCalledOnce();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  ME-53: Arrow key nudge                                             */
  /* ------------------------------------------------------------------ */

  describe('ME-53 arrow key nudge', () => {
    const typeEl = {
      id: 'type-1',
      type: 'type',
      name: 'Test',
      attributes: [] as string[],
      methods: [] as string[],
      layout: { x: 100, y: 200, width: 180, height: 60 },
    };

    const noteEl = {
      id: 'note-1',
      type: 'note',
      content: 'Note',
      layout: { x: 300, y: 400, width: 200, height: 70 },
    };

    beforeEach(() => {
      vi.clearAllMocks();
      editorState.selectedIds = [];
      diagramState.elements = [];
      historyState.push.mockClear();
      diagramState.setElements.mockClear();
    });

    it('moves selected element 1px right on ArrowRight', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      expect(historyState.push).toHaveBeenCalledTimes(1);
      expect(diagramState.setElements).toHaveBeenCalledTimes(1);

      const updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.x).toBe(101);
      expect(updated[0].layout.y).toBe(200); // unchanged
    });

    it('moves selected element 1px down on ArrowDown', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.x).toBe(100); // unchanged
      expect(updated[0].layout.y).toBe(201);
    });

    it('moves selected element 1px up on ArrowUp', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.y).toBe(199);
    });

    it('moves selected element 1px left on ArrowLeft', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.x).toBe(99);
    });

    it('moves by 10px when Shift is held', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          shiftKey: true,
          bubbles: true,
        }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.x).toBe(110);
      expect(updated[0].layout.y).toBe(200);
    });

    it('nudges multiple selected elements simultaneously', () => {
      diagramState.elements = [typeEl, noteEl];
      editorState.selectedIds = ['type-1', 'note-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      expect(updated).toHaveLength(2);
      // type-1 moved
      const t = updated.find((e: { id: string }) => e.id === 'type-1');
      expect(t.layout.x).toBe(101);
      expect(t.layout.y).toBe(200);
      // note-1 moved
      const n = updated.find((e: { id: string }) => e.id === 'note-1');
      expect(n.layout.x).toBe(301);
      expect(n.layout.y).toBe(400);
    });

    it('does not nudge when no elements are selected', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = [];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      expect(historyState.push).not.toHaveBeenCalled();
      expect(diagramState.setElements).not.toHaveBeenCalled();
    });

    it('does not nudge when focus is on an input element', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      // Create a mock input as activeElement
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      expect(historyState.push).not.toHaveBeenCalled();
      expect(diagramState.setElements).not.toHaveBeenCalled();

      document.body.removeChild(input);
    });

    it('does not nudge when focus is on a textarea', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      expect(historyState.push).not.toHaveBeenCalled();
      expect(diagramState.setElements).not.toHaveBeenCalled();

      document.body.removeChild(textarea);
    });

    it('does not nudge when Ctrl+Arrow is pressed (reserved for future use)', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowRight',
          ctrlKey: true,
          bubbles: true,
        }),
      );

      expect(historyState.push).not.toHaveBeenCalled();
      expect(diagramState.setElements).not.toHaveBeenCalled();
    });

    it('pushes state to history once for batch nudge', () => {
      diagramState.elements = [typeEl, noteEl];
      editorState.selectedIds = ['type-1', 'note-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      // Should only push to history once, not once per element
      expect(historyState.push).toHaveBeenCalledTimes(1);
    });

    it('preserves non-selected elements when nudging', () => {
      diagramState.elements = [typeEl, noteEl];
      editorState.selectedIds = ['type-1']; // only type-1 selected

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      const t = updated.find((e: { id: string }) => e.id === 'type-1');
      expect(t.layout.y).toBe(201); // moved

      const n = updated.find((e: { id: string }) => e.id === 'note-1');
      expect(n.layout.y).toBe(400); // unchanged
    });

    /* ------------------------------------------------------------------ */
    /*  ME-53 arrow key nudge edge cases                                   */
    /* ------------------------------------------------------------------ */

    it('preserves element type and other properties after nudge', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      const el = updated[0];

      // Core properties are preserved
      expect(el.id).toBe('type-1');
      expect(el.type).toBe('type');
      expect(el.name).toBe('Test');
      expect(el.attributes).toEqual([]);
      expect(el.methods).toEqual([]);
      // Layout is updated correctly
      expect(el.layout.x).toBe(101);
      expect(el.layout.y).toBe(200);
      expect(el.layout.width).toBe(180);
      expect(el.layout.height).toBe(60);
    });

    it('skips selected relation elements (no layout) during nudge', () => {
      const relEl = {
        id: 'rel-1',
        type: 'relation',
        sourceId: 'type-1',
        targetId: 'type-2',
        sourceCardinality: 'exactly_one',
        targetCardinality: 'zero_or_many',
        label: 'test',
      };
      diagramState.elements = [typeEl, relEl as never];
      editorState.selectedIds = ['type-1', 'rel-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );

      const updated = diagramState.setElements.mock.calls[0][0];
      // Type node was nudged
      const t = updated.find((e: { id: string }) => e.id === 'type-1');
      expect(t.layout.x).toBe(101);
      // Relation element is unchanged (no layout to modify)
      const r = updated.find((e: { id: string }) => e.id === 'rel-1');
      expect(r.type).toBe('relation');
      expect(r.layout).toBeUndefined();
    });

    it('does not nudge when focus is on a contentEditable element', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      document.body.appendChild(editable);
      editable.focus();

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }),
      );

      expect(historyState.push).not.toHaveBeenCalled();
      expect(diagramState.setElements).not.toHaveBeenCalled();

      document.body.removeChild(editable);
    });

    it('nudges by 10px with Shift+Arrow in each direction', () => {
      diagramState.elements = [typeEl];
      editorState.selectedIds = ['type-1'];

      render(<TestHarness />);

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowLeft',
          shiftKey: true,
          bubbles: true,
        }),
      );
      let updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.x).toBe(90);
      expect(updated[0].layout.y).toBe(200);

      vi.clearAllMocks();

      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'ArrowUp',
          shiftKey: true,
          bubbles: true,
        }),
      );
      updated = diagramState.setElements.mock.calls[0][0];
      expect(updated[0].layout.x).toBe(100);
      expect(updated[0].layout.y).toBe(190);
    });
  });
});

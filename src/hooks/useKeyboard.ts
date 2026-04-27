import { useEffect } from 'react';
import { useHistoryStore } from '../store/useHistoryStore';
import { useDiagramStore } from '../store/useDiagramStore';
import { useEditorStore } from '../store/useEditorStore';
import type { DiagramElement } from '../models/diagram';

/**
 * Check whether an element has a layout property (i.e. is a positioned
 * element rather than a relation line).
 */
function hasLayout(el: DiagramElement): el is DiagramElement & { layout: { x: number; y: number; width: number; height: number } } {
  return 'layout' in el;
}

/**
 * Hook for managing keyboard shortcuts in the editor.
 * Registers global keydown/keyup listeners and maps shortcuts to editor actions.
 *
 * Shortcuts:
 *   Ctrl+Z / Cmd+Z      - Undo
 *   Ctrl+Y / Cmd+Y       - Redo
 *   Ctrl+Shift+Z / Cmd+Shift+Z  - Redo (alternative)
 *   Delete / Backspace    - Delete selected elements
 *   Escape                - Deselect all / cancel
 *   Arrow keys            - Nudge selected elements by 1px (10px with Shift)
 */
export function useKeyboard(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;

      // Undo: Ctrl+Z
      if (ctrl && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        const history = useHistoryStore.getState();
        const state = history.undo();
        if (state) {
          useDiagramStore.getState().setElements(state.elements);
        }
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((ctrl && event.key === 'y') || (ctrl && event.shiftKey && event.key === 'z')) {
        event.preventDefault();
        const history = useHistoryStore.getState();
        const state = history.redo();
        if (state) {
          useDiagramStore.getState().setElements(state.elements);
        }
        return;
      }

      // Delete: Delete or Backspace key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        const editor = useEditorStore.getState();
        const ids = editor.selectedIds;
        if (ids.length > 0) {
          event.preventDefault();
          useDiagramStore.getState().deleteSelectedElements(ids);
        }
        return;
      }

      // Escape: deselect all
      if (event.key === 'Escape') {
        useEditorStore.getState().deselectAll();
        return;
      }

      // Arrow key nudge: move selected elements by 1px (10px with Shift).
      // Do not intercept when focus is inside an input / textarea so that
      // native cursor navigation works as expected.
      const arrowKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
      if (arrowKeys.includes(event.key) && !ctrl) {
        const activeEl = document.activeElement;
        if (activeEl) {
          const tag = activeEl.tagName.toLowerCase();
          if (
            tag === 'input' ||
            tag === 'textarea' ||
            tag === 'select' ||
            activeEl.getAttribute('contenteditable') === 'true'
          ) {
            return; // let the input handle the arrow key
          }
        }

        const editor = useEditorStore.getState();
        const diagram = useDiagramStore.getState();
        const ids = editor.selectedIds;

        if (ids.length === 0) return;

        event.preventDefault();

        const step = event.shiftKey ? 10 : 1;
        let dx = 0;
        let dy = 0;
        switch (event.key) {
          case 'ArrowUp':    dy = -step; break;
          case 'ArrowDown':  dy = step;  break;
          case 'ArrowLeft':  dx = -step; break;
          case 'ArrowRight': dx = step;  break;
        }

        // Push current state to history once, then batch-update all
        // selected positioned elements in a single setElements call.
        useHistoryStore.getState().push(diagram);

        const updatedElements = diagram.elements.map((el) => {
          if (ids.includes(el.id) && hasLayout(el)) {
            return {
              ...el,
              layout: {
                ...el.layout,
                x: el.layout.x + dx,
                y: el.layout.y + dy,
              },
            };
          }
          return el;
        });

        useDiagramStore.getState().setElements(updatedElements);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

export default useKeyboard;

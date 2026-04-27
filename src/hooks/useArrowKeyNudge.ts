import { useEffect } from 'react';
import useEditorStore from '../store/useEditorStore';
import useHistoryStore from '../store/useHistoryStore';

/**
 * Hook that listens for arrow keys (up/down/left/right) and nudges selected
 * elements by a fixed step (1px by default, 10px when Shift is held).
 *
 * - Only active when currentTool === 'select'
 * - Skips the event if focus is on an input, textarea, or contenteditable element
 * - Pushes a single history entry before the batch update (repeats skip history)
 * - Attached notes follow their parent type when it is nudged
 */
export function useArrowKeyNudge(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        return;
      }

      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const store = useEditorStore.getState();

      // Only nudge in select mode
      if (store.currentTool !== 'select') return;
      if (store.selectedIds.length === 0) return;

      e.preventDefault();

      // Calculate delta based on Shift modifier
      const step = e.shiftKey ? 10 : 1;
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case 'ArrowUp':
          dy = -step;
          break;
        case 'ArrowDown':
          dy = step;
          break;
        case 'ArrowLeft':
          dx = -step;
          break;
        case 'ArrowRight':
          dx = step;
          break;
      }

      const { selectedIds, canvasElements } = store;

      // Collect IDs to nudge: selected elements + notes attached to selected types
      const idsToNudge = new Set<string>(selectedIds);
      canvasElements.forEach((el) => {
        if (
          el.type === 'note' &&
          el.attachedToId &&
          selectedIds.includes(el.attachedToId)
        ) {
          idsToNudge.add(el.id);
        }
      });

      // Push history only on the initial press, not on OS key-repeat events
      if (!e.repeat) {
        useHistoryStore.getState().push(structuredClone(canvasElements));
      }

      // Update positions for all nudged elements in a single batch
      const newElements = canvasElements.map((el) => {
        if (
          idsToNudge.has(el.id) &&
          (el.type === 'type' || el.type === 'note' || el.type === 'generalization')
        ) {
          return { ...el, x: el.x + dx, y: el.y + dy };
        }
        return el;
      });

      useEditorStore.setState({ canvasElements: newElements });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}

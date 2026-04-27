import { useEffect } from 'react';

export function useKeyboard(key: string, handler: () => void): void {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === key && !e.repeat) {
        handler();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [key, handler]);
}

/**
 * Hook that listens for Delete and Backspace keys and invokes the handler.
 * Skips the event if the focus is on an input, textarea, or contenteditable element.
 */
export function useDeleteKey(handler: () => void): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      if (e.repeat) return;

      // Ignore if user is typing in an input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      handler();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handler]);
}

import { useEffect, useRef } from 'react';
import { useDiagramStore } from '../store/useDiagramStore';
import { useFileStore } from '../store/useFileStore';
import { SAVE_DEBOUNCE_MS } from '../constants/defaults';

/**
 * Hook for automatically saving the diagram to localStorage.
 *
 * Listens for changes to diagram elements or metadata, then debounces and
 * triggers a save via the file store's saveCurrentFile action.
 */
export function useAutoSave(): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elements = useDiagramStore((state) => state.elements);
  const metadata = useDiagramStore((state) => state.metadata);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      useFileStore.getState().saveCurrentFile();
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [elements, metadata]);
}

export default useAutoSave;

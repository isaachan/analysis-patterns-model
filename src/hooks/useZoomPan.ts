import { useCallback } from 'react';
import { useEditorStore } from '../store/useEditorStore';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../constants/defaults';

/**
 * Hook for managing canvas zoom and pan operations.
 * Provides zoom in/out/reset and pan control functions.
 */
export function useZoomPan() {
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const resetView = useEditorStore((s) => s.resetView);

  const zoomIn = useCallback(() => {
    setZoom(Math.min(zoom + ZOOM_STEP, MAX_ZOOM));
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    setZoom(Math.max(zoom - ZOOM_STEP, MIN_ZOOM));
  }, [zoom, setZoom]);

  return {
    zoom,
    zoomIn,
    zoomOut,
    resetView,
  };
}

export default useZoomPan;

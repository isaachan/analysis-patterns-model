import { useCallback } from 'react';
import type Konva from 'konva';
import useEditorStore from '../store/useEditorStore';
import { MIN_ZOOM, MAX_ZOOM, ZOOM_STEP } from '../constants/defaults';

export function useZoomPan() {
  const zoom = useEditorStore((s) => s.zoom);
  const panX = useEditorStore((s) => s.panX);
  const panY = useEditorStore((s) => s.panY);
  const setZoom = useEditorStore((s) => s.setZoom);
  const setPan = useEditorStore((s) => s.setPan);
  const resetView = useEditorStore((s) => s.resetView);

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + ZOOM_STEP, MAX_ZOOM);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - ZOOM_STEP, MIN_ZOOM);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();

    const stage = e.target.getStage();
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldZoom = zoom;
    // Use a multiplicative scale factor for natural-feeling zoom
    const scaleBy = 1.1;
    const newZoom =
      e.evt.deltaY > 0
        ? Math.max(MIN_ZOOM, oldZoom / scaleBy)
        : Math.min(MAX_ZOOM, oldZoom * scaleBy);

    if (newZoom === oldZoom) return;

    // Zoom centered on mouse pointer:
    // Convert pointer position (relative to stage origin) to world coordinates,
    // then compute new pan offset so the same world point remains under the cursor.
    const newPanX = panX + pointer.x - (pointer.x / oldZoom) * newZoom;
    const newPanY = panY + pointer.y - (pointer.y / oldZoom) * newZoom;

    setPan(newPanX, newPanY);
    setZoom(newZoom);
  }, [zoom, panX, panY, setZoom, setPan]);

  return { zoom, panX, panY, setPan, zoomIn, zoomOut, resetView, handleWheel };
}

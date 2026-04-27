import { create } from 'zustand';
import type { ToolMode, EditorState } from '../models/editor';
import { DEFAULT_ZOOM } from '../constants/defaults';

interface EditorActions {
  setTool: (tool: ToolMode) => void;
  select: (id: string | string[]) => void;
  deselectAll: () => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  setHoveredId: (id: string | null) => void;
  setGridEnabled: (enabled: boolean) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setIsDragging: (dragging: boolean) => void;
  setRelationSource: (id: string | null) => void;
  setRelationEndPoint: (point: { x: number; y: number } | null) => void;
  clearRelationState: () => void;
  setGeneralizationParent: (id: string | null) => void;
  clearGeneralizationState: () => void;
}

export type EditorStore = EditorState & EditorActions;

export const useEditorStore = create<EditorStore>((set) => ({
  currentTool: 'select',
  selectedIds: [],
  hoveredId: null,
  zoom: DEFAULT_ZOOM,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  snapEnabled: true,
  isDragging: false,
  relationSourceId: null,
  relationEndPoint: null,
  generalizationParentId: null,

  setTool: (tool) =>
    set((state) => ({
      currentTool: tool,
      // Clear relation state when switching away from 'relation' tool
      ...(state.currentTool !== tool && state.currentTool === 'relation'
        ? { relationSourceId: null, relationEndPoint: null }
        : {}),
      // Clear generalization state when switching away from 'generalization' tool
      ...(state.currentTool !== tool && state.currentTool === 'generalization'
        ? { generalizationParentId: null }
        : {}),
    })),

  select: (id) =>
    set({
      selectedIds: Array.isArray(id) ? id : [id],
    }),

  deselectAll: () => set({ selectedIds: [] }),

  setZoom: (zoom) =>
    set({
      zoom: Math.max(0.1, Math.min(5, zoom)),
    }),

  setPan: (x, y) => set({ panX: x, panY: y }),

  resetView: () => set({ zoom: DEFAULT_ZOOM, panX: 0, panY: 0 }),

  setHoveredId: (id) => set({ hoveredId: id }),

  setGridEnabled: (enabled) => set({ gridEnabled: enabled }),

  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

  setIsDragging: (dragging) => set({ isDragging: dragging }),

  setRelationSource: (id) => set({ relationSourceId: id }),

  setRelationEndPoint: (point) => set({ relationEndPoint: point }),

  clearRelationState: () => set({ relationSourceId: null, relationEndPoint: null }),

  setGeneralizationParent: (id) => set({ generalizationParentId: id }),

  clearGeneralizationState: () => set({ generalizationParentId: null }),
}));

export default useEditorStore;

import { create } from 'zustand';
import type { ToolMode } from '../models/editor';
import useHistoryStore from './useHistoryStore';
import { deleteDiagram } from '../utils/storage';

export type AssociationTag = 'hierarchy' | 'dag' | 'multiple_hierarchies';

export interface AttachmentPoint {
  side: 'left' | 'right' | 'top' | 'bottom';
  ratio: number; // 0-1 along that edge (0=start, 0.5=center, 1=end)
}

export interface CanvasElement {
  id: string;
  type: 'rect' | 'line' | 'text' | 'type' | 'relation' | 'generalization' | 'note';
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: number[];
  text?: string;
  name?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  rotation?: number;
  fontSize?: number;
  // Relation-specific fields
  sourceId?: string;
  targetId?: string;
  sourceCardinality?: string;
  targetCardinality?: string;
  sourceAttachment?: AttachmentPoint;
  targetAttachment?: AttachmentPoint;
  isSelfReference?: boolean;
  associationTags?: AssociationTag[];
  // Generalization-specific fields
  parentTypeId?: string;
  isComplete?: boolean;
  // Container reference: when set, this element is inside a generalization container
  containerId?: string;
  // Short semantic statement tag (e.g., "abstract", "immutable", "singleton")
  shortSemantic?: string;
  // Note-specific fields
  title?: string;
  content?: string;
  titleType?: string;
  attachedToId?: string;
  // Waypoints for line path editing (user-draggable control points)
  waypoints?: { x: number; y: number }[];
}

export interface FileMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

let nextFileId = 1;

function generateFileId(): string {
  return `file_${Date.now()}_${nextFileId++}`;
}

function generateFileTitle(existingFiles: FileMeta[]): string {
  const untitledPattern = /^Untitled(?:-(\d+))?$/;
  let maxSuffix = 0;
  for (const f of existingFiles) {
    const match = f.title.match(untitledPattern);
    if (match) {
      const suffix = match[1] ? parseInt(match[1], 10) : 0;
      if (suffix >= maxSuffix) {
        maxSuffix = suffix + 1;
      }
    }
  }
  return maxSuffix === 0 ? 'Untitled' : `Untitled-${maxSuffix}`;
}

interface EditorState {
  currentTool: ToolMode;
  selectedIds: string[];
  hoveredId: string | null;
  zoom: number;
  panX: number;
  panY: number;
  gridEnabled: boolean;
  gridSize: number;
  snapEnabled: boolean;
  isDragging: boolean;

  // Canvas elements
  canvasElements: CanvasElement[];

  // File management
  files: FileMeta[];
  currentFileId: string | null;
  /** Per-file canvas data kept in memory so switching files doesn't lose work */
  fileCanvasData: Record<string, CanvasElement[]>;

  // Actions
  setTool: (tool: ToolMode) => void;
  select: (id: string | string[]) => void;
  deselectAll: () => void;
  setZoom: (zoom: number) => void;
  setPan: (x: number, y: number) => void;
  resetView: () => void;
  setGridEnabled: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setSnapEnabled: (enabled: boolean) => void;
  setIsDragging: (dragging: boolean) => void;

  // Element actions
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  deleteElement: (id: string) => void;

  // File actions
  createNewFile: () => void;
  switchFile: (id: string) => void;
  renameFile: (id: string, title: string) => void;
  deleteFile: (id: string) => void;

  // Save status
  saveStatus: 'saved' | 'saving' | 'error';
  saveErrorMessage: string;

  // History actions
  applyUndo: () => void;
  applyRedo: () => void;

  setSaveStatus: (status: 'saved' | 'saving' | 'error', message?: string) => void;
}

let initialFileId: string | null = null;
let initialFiles: FileMeta[] = [];
let initialFileCanvasData: Record<string, CanvasElement[]> = {};

// Initialize with a default untitled file
{
  const id = generateFileId();
  initialFileId = id;
  initialFiles = [{ id, title: 'Untitled', createdAt: Date.now(), updatedAt: Date.now() }];
  initialFileCanvasData = { [id]: [] };
}

const useEditorStore = create<EditorState>((set, get) => ({
  currentTool: 'select',
  selectedIds: [],
  hoveredId: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  gridEnabled: true,
  gridSize: 20,
  snapEnabled: true,
  isDragging: false,

  // Canvas elements
  canvasElements: [],

  // File management
  files: initialFiles,
  currentFileId: initialFileId,
  fileCanvasData: initialFileCanvasData,

  // Save status
  saveStatus: 'saved',
  saveErrorMessage: '',

  setSaveStatus: (status, message = '') =>
    set({ saveStatus: status, saveErrorMessage: message }),

  setTool: (tool) => set({ currentTool: tool }),

  select: (id) =>
    set({
      selectedIds: Array.isArray(id) ? id : [id],
    }),

  deselectAll: () => set({ selectedIds: [] }),

  setZoom: (zoom) => set({ zoom }),

  setPan: (panX, panY) => set({ panX, panY }),

  resetView: () => set({ zoom: 1, panX: 0, panY: 0 }),

  setGridEnabled: (enabled) => set({ gridEnabled: enabled }),

  setGridSize: (size) => set({ gridSize: size }),

  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),

  setIsDragging: (dragging) => set({ isDragging: dragging }),

  addElement: (element) =>
    set((state) => {
      // Push current state snapshot to history before mutation
      useHistoryStore.getState().push(structuredClone(state.canvasElements));
      return {
        canvasElements: [...state.canvasElements, element],
      };
    }),

  updateElement: (id, updates) =>
    set((state) => {
      // Debounce: skip history push during drag to coalesce continuous drag frames
      if (!state.isDragging) {
        useHistoryStore.getState().push(structuredClone(state.canvasElements));
      }
      return {
        canvasElements: state.canvasElements.map((el) =>
          el.id === id ? { ...el, ...updates } : el,
        ),
      };
    }),

  deleteElement: (id) =>
    set((state) => {
      // Push current state snapshot to history before mutation
      useHistoryStore.getState().push(structuredClone(state.canvasElements));

      const element = state.canvasElements.find((el) => el.id === id);
      if (!element) return state;

      const idsToDelete = new Set<string>([id]);

      // If deleting a Type, also delete all relations and generalizations that reference it
      if (element.type === 'type') {
        state.canvasElements.forEach((el) => {
          if (
            el.type === 'relation' &&
            (el.sourceId === id || el.targetId === id)
          ) {
            idsToDelete.add(el.id);
          }
          if (el.type === 'generalization' && el.parentTypeId === id) {
            idsToDelete.add(el.id);
          }
        });
      }

      // If deleting a generalization, also delete child types inside it
      if (element.type === 'generalization') {
        state.canvasElements.forEach((el) => {
          if (el.containerId === id) {
            idsToDelete.add(el.id);
          }
        });
      }

      // Also deselect if the deleted element was selected
      const newSelectedIds = state.selectedIds.filter(
        (sid) => !idsToDelete.has(sid),
      );

      return {
        canvasElements: state.canvasElements.filter(
          (el) => !idsToDelete.has(el.id),
        ),
        selectedIds: newSelectedIds,
      };
    }),

  createNewFile: () => {
    const state = get();
    const id = generateFileId();
    const title = generateFileTitle(state.files);
    const now = Date.now();
    const newFile: FileMeta = { id, title, createdAt: now, updatedAt: now };

    // Save current canvas data under the current file before switching
    const currentFileId = state.currentFileId;
    const updatedFileCanvasData = { ...state.fileCanvasData };
    if (currentFileId) {
      updatedFileCanvasData[currentFileId] = state.canvasElements;
    }
    updatedFileCanvasData[id] = [];

    // Reset history for the new file
    useHistoryStore.getState().past = [];
    useHistoryStore.getState().future = [];

    set({
      files: [...state.files, newFile],
      currentFileId: id,
      fileCanvasData: updatedFileCanvasData,
      canvasElements: [],
      selectedIds: [],
    });
  },

  switchFile: (id: string) => {
    const state = get();
    if (id === state.currentFileId) return;

    // Save current canvas data under the current file
    const updatedFileCanvasData = { ...state.fileCanvasData };
    if (state.currentFileId) {
      updatedFileCanvasData[state.currentFileId] = state.canvasElements;
    }

    // Load target file's canvas data (or empty if none)
    const targetCanvas = updatedFileCanvasData[id] || [];

    set({
      currentFileId: id,
      fileCanvasData: updatedFileCanvasData,
      canvasElements: targetCanvas,
      selectedIds: [],
      zoom: 1,
      panX: 0,
      panY: 0,
    });
  },

  renameFile: (id: string, title: string) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.id === id ? { ...f, title, updatedAt: Date.now() } : f,
      ),
    }));
  },

  deleteFile: (id: string) => {
    const state = get();

    // Remove file data from localStorage
    deleteDiagram(id);

    // Remove from files array
    const newFiles = state.files.filter((f) => f.id !== id);

    // Remove from fileCanvasData
    const newFileCanvasData = { ...state.fileCanvasData };
    delete newFileCanvasData[id];

    if (id === state.currentFileId) {
      // If no files left, create a new one
      if (newFiles.length === 0) {
        const newId = generateFileId();
        const now = Date.now();
        const newFile: FileMeta = {
          id: newId,
          title: 'Untitled',
          createdAt: now,
          updatedAt: now,
        };

        useHistoryStore.getState().past = [];
        useHistoryStore.getState().future = [];

        set({
          files: [newFile],
          currentFileId: newId,
          fileCanvasData: { [newId]: [] },
          canvasElements: [],
          selectedIds: [],
        });
      } else {
        // Switch to most recently updated other file
        const sorted = [...newFiles].sort(
          (a, b) => b.updatedAt - a.updatedAt,
        );
        const targetId = sorted[0].id;
        const targetCanvas = newFileCanvasData[targetId] || [];

        useHistoryStore.getState().past = [];
        useHistoryStore.getState().future = [];

        set({
          files: newFiles,
          currentFileId: targetId,
          fileCanvasData: newFileCanvasData,
          canvasElements: targetCanvas,
          selectedIds: [],
        });
      }
    } else {
      set({
        files: newFiles,
        fileCanvasData: newFileCanvasData,
      });
    }
  },

  applyUndo: () => {
    const { canvasElements } = get();
    const previousState = useHistoryStore
      .getState()
      .undo(structuredClone(canvasElements));
    if (previousState !== null) {
      set({ canvasElements: previousState as CanvasElement[] });
    }
  },

  applyRedo: () => {
    const { canvasElements } = get();
    const nextState = useHistoryStore
      .getState()
      .redo(structuredClone(canvasElements));
    if (nextState !== null) {
      set({ canvasElements: nextState as CanvasElement[] });
    }
  },
}));

export default useEditorStore;

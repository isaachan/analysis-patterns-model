import { create } from 'zustand';
import type { DiagramElement, GeneralizationElement, LongSemanticElement } from '../models/diagram';
import type { DiagramState } from '../models/diagram';
import { EMPTY_DIAGRAM } from '../constants/defaults';
import { useHistoryStore } from './useHistoryStore';

interface DiagramActions {
  addElement: (element: DiagramElement) => void;
  updateElement: (id: string, updates: Partial<DiagramElement>) => void;
  deleteElement: (id: string) => void;
  /** Delete multiple elements by id. Cascades: deleting a Type also deletes its relations and generalization containers. LongSemantic notes attached to deleted elements become free-floating. */
  deleteSelectedElements: (ids: string[]) => void;
  setElements: (elements: DiagramElement[]) => void;
  clearAll: () => void;
}

export type DiagramStore = DiagramState & DiagramActions;

export const useDiagramStore = create<DiagramStore>((set, get) => ({
  ...EMPTY_DIAGRAM,

  addElement: (element) => {
    useHistoryStore.getState().push(get());
    set((state) => ({
      elements: [...state.elements, element],
    }));
  },

  updateElement: (id, updates) => {
    useHistoryStore.getState().push(get());
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? ({ ...el, ...updates } as DiagramElement) : el,
      ),
    }));
  },

  deleteElement: (id) => {
    useHistoryStore.getState().push(get());
    const state = get();
    const toDelete = new Set<string>([id]);

    // If deleting a Type, also delete its generalization containers where it's the parent
    const el = state.elements.find((e) => e.id === id);
    if (el && el.type === 'type') {
      for (const other of state.elements) {
        if (other.type === 'generalization' && (other as GeneralizationElement).parentId === id) {
          toDelete.add(other.id);
        }
      }
    }

    // Detach any LongSemanticElement attached to the deleted element
    const updatedElements = state.elements.map((e) => {
      if (
        toDelete.has(id) &&
        e.type === 'longSemantic' &&
        (e as LongSemanticElement).attachedTo === id
      ) {
        return { ...e, attachedTo: undefined } as LongSemanticElement;
      }
      return e;
    });

    set({
      elements: updatedElements.filter((el) => !toDelete.has(el.id)),
    });
  },

  deleteSelectedElements: (ids) => {
    useHistoryStore.getState().push(get());
    const state = get();
    // Collect all ids to delete, cascading:
    // - if a Type is deleted, also delete its relations
    // - if a Type is deleted, also delete its generalization containers (where it's parent)
    const toDelete = new Set<string>(ids);
    for (const el of state.elements) {
      if (el.type === 'type' && toDelete.has(el.id)) {
        for (const other of state.elements) {
          if (
            other.type === 'relation' &&
            (other.sourceId === el.id || other.targetId === el.id)
          ) {
            toDelete.add(other.id);
          }
          if (
            other.type === 'generalization' &&
            (other as GeneralizationElement).parentId === el.id
          ) {
            toDelete.add(other.id);
          }
        }
      }
    }

    // Detach (don't delete) any LongSemanticElement attached to a deleted element
    const updatedElements = state.elements.map((e) => {
      if (
        e.type === 'longSemantic' &&
        e.attachedTo &&
        toDelete.has(e.attachedTo)
      ) {
        return { ...e, attachedTo: undefined } as LongSemanticElement;
      }
      return e;
    });

    set({
      elements: updatedElements.filter((el) => !toDelete.has(el.id)),
    });
  },

  /** Used internally by undo/redo -- does NOT push to history. */
  setElements: (elements) => set({ elements }),

  clearAll: () => {
    useHistoryStore.getState().push(get());
    set({ elements: [] });
  },
}));

export default useDiagramStore;

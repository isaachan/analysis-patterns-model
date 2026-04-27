import { create } from 'zustand';

interface DiagramElement {
  id: string;
  type: 'type' | 'relation' | 'generalization' | 'note';
}

interface DiagramState {
  version: string;
  metadata: {
    title: string;
    createdAt: number;
    updatedAt: number;
  };
  elements: DiagramElement[];

  // Actions
  addElement: (element: DiagramElement) => void;
  updateElement: (id: string, updates: Partial<DiagramElement>) => void;
  deleteElement: (id: string) => void;
  setElements: (elements: DiagramElement[]) => void;
  clearAll: () => void;
}

const useDiagramStore = create<DiagramState>((set) => ({
  version: '1.0',
  metadata: {
    title: 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  elements: [],

  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, element],
      metadata: { ...state.metadata, updatedAt: Date.now() },
    })),

  updateElement: (id, updates) =>
    set((state) => ({
      elements: state.elements.map((el) =>
        el.id === id ? { ...el, ...updates } : el,
      ),
      metadata: { ...state.metadata, updatedAt: Date.now() },
    })),

  deleteElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      metadata: { ...state.metadata, updatedAt: Date.now() },
    })),

  setElements: (elements) =>
    set(() => ({
      elements,
      metadata: { ...useDiagramStore.getState().metadata, updatedAt: Date.now() },
    })),

  clearAll: () =>
    set((state) => ({
      elements: [],
      metadata: { ...state.metadata, updatedAt: Date.now() },
    })),
}));

export default useDiagramStore;

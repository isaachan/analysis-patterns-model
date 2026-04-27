import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFileStore } from '../store/useFileStore';
import type { FileEntry } from '../utils/storage';
import type { DiagramState } from '../models/diagram';

/* ------------------------------------------------------------------ */
/*  Hoisted state and mock references for storage module               */
/* ------------------------------------------------------------------ */

const mock = vi.hoisted(() => {
  const index: FileEntry[] = [];
  const files = new Map<string, DiagramState>();
  let currentId: string | null = null;

  const saveFile = vi.fn((id: string, state: DiagramState) => {
    files.set(id, { ...state });
    return true;
  });

  const renameFile = vi.fn((id: string, title: string) => {
    const entry = index.find((f) => f.id === id);
    if (!entry) return false;
    entry.title = title;
    entry.updatedAt = Date.now();
    return true;
  });

  const setCurrentFileId = vi.fn((id: string | null) => {
    currentId = id;
  });

  const createNewFile = vi.fn((title?: string) => {
    const id = `mock-id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const baseTitle = title || 'Untitled';
    const existingTitles = new Set(index.map((f) => f.title));
    let finalTitle = baseTitle;
    let counter = 1;
    while (existingTitles.has(finalTitle)) {
      finalTitle = `${baseTitle}-${counter}`;
      counter++;
    }
    const state: DiagramState = {
      version: '1.0.0',
      metadata: { title: finalTitle, createdAt: now, updatedAt: now },
      elements: [],
    };
    files.set(id, { ...state });
    const entry: FileEntry = { id, title: finalTitle, createdAt: now, updatedAt: now };
    index.push(entry);
    currentId = id;
    return { id, state };
  });

  return {
    index,
    files,
    currentId: { get: () => currentId, set: (v: string | null) => { currentId = v; } },
    saveFile,
    renameFile,
    setCurrentFileId,
    createNewFile,
  };
});

/* ------------------------------------------------------------------ */
/*  Mock storage module                                                */
/* ------------------------------------------------------------------ */

vi.mock('../utils/storage', () => ({
  getFileIndex: vi.fn(() => [...mock.index]),
  saveFileIndex: vi.fn((idx: FileEntry[]) => {
    mock.index.length = 0;
    mock.index.push(...idx);
    return true;
  }),
  getFile: vi.fn((id: string) => mock.files.get(id) ?? null),
  saveFile: mock.saveFile,
  deleteFile: vi.fn((id: string) => {
    const idx = mock.index.findIndex((f) => f.id === id);
    if (idx >= 0) mock.index.splice(idx, 1);
    mock.files.delete(id);
    if (mock.currentId.get() === id) mock.currentId.set(null);
  }),
  getCurrentFileId: vi.fn(() => mock.currentId.get()),
  setCurrentFileId: mock.setCurrentFileId,
  createNewFile: mock.createNewFile,
  renameFile: mock.renameFile,
  clearAllFiles: vi.fn(() => {
    mock.index.length = 0;
    mock.files.clear();
    mock.currentId.set(null);
  }),
}));

/* ------------------------------------------------------------------ */
/*  Mock dependent stores                                              */
/* ------------------------------------------------------------------ */

const diagramSetState = vi.hoisted(() => vi.fn());

vi.mock('../store/useDiagramStore', () => ({
  useDiagramStore: {
    getState: vi.fn(() => ({
      version: '1.0.0',
      metadata: { title: 'Test', createdAt: 0, updatedAt: 0 },
      elements: [
        {
          id: 'el-1',
          type: 'type',
          name: 'Test',
          attributes: [],
          methods: [],
          layout: { x: 0, y: 0, width: 100, height: 60 },
        },
      ],
    })),
    setState: diagramSetState,
    subscribe: vi.fn(),
    destroy: vi.fn(),
  },
}));

vi.mock('../store/useHistoryStore', () => ({
  useHistoryStore: {
    getState: vi.fn(() => ({
      past: [],
      future: [],
      push: vi.fn(),
      undo: vi.fn(),
      redo: vi.fn(),
      canUndo: vi.fn(() => false),
      canRedo: vi.fn(() => false),
      clear: vi.fn(),
    })),
  },
}));

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('useFileStore', () => {
  beforeEach(() => {
    mock.index.length = 0;
    mock.files.clear();
    mock.currentId.set(null);
    vi.clearAllMocks();
    useFileStore.setState({
      currentFileId: null,
      files: [],
      storageError: null,
    });
  });

  /* ------------------------------------------------------------------ */
  /*  newFile                                                            */
  /* ------------------------------------------------------------------ */

  describe('newFile', () => {
    it('creates a new file and sets it as current', () => {
      useFileStore.getState().newFile();
      const state = useFileStore.getState();
      expect(state.currentFileId).toBeTruthy();
      expect(state.files).toHaveLength(1);
      expect(state.storageError).toBeNull();
    });

    it('creates a file with "Untitled" title', () => {
      useFileStore.getState().newFile();
      expect(useFileStore.getState().files[0].title).toBe('Untitled');
    });

    it('saves current file before creating a new one', () => {
      useFileStore.getState().newFile();
      const saveSpy = vi.spyOn(useFileStore.getState(), 'saveCurrentFile');

      useFileStore.getState().newFile();
      expect(saveSpy).toHaveBeenCalled();
      expect(useFileStore.getState().files).toHaveLength(2);

      saveSpy.mockRestore();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  saveCurrentFile                                                    */
  /* ------------------------------------------------------------------ */

  describe('saveCurrentFile', () => {
    it('does nothing when no file is current', () => {
      useFileStore.getState().saveCurrentFile();
      expect(mock.saveFile).not.toHaveBeenCalled();
    });

    it('saves the current diagram state', () => {
      useFileStore.getState().newFile();
      useFileStore.getState().saveCurrentFile();
      expect(mock.saveFile).toHaveBeenCalled();
      const [savedId] = mock.saveFile.mock.calls[0];
      expect(savedId).toBe(useFileStore.getState().currentFileId);
    });

    it('clears storageError on successful save', () => {
      useFileStore.getState().newFile();
      useFileStore.setState({ storageError: 'Previous error' });
      useFileStore.getState().saveCurrentFile();
      expect(useFileStore.getState().storageError).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  loadFile                                                           */
  /* ------------------------------------------------------------------ */

  describe('loadFile', () => {
    it('loads the correct file data', () => {
      useFileStore.getState().newFile();
      const firstId = useFileStore.getState().currentFileId!;
      useFileStore.getState().newFile();

      // Switch back to the first file
      useFileStore.getState().loadFile(firstId);
      expect(useFileStore.getState().currentFileId).toBe(firstId);
      expect(diagramSetState).toHaveBeenCalled();
    });

    it('sets storageError when file not found', () => {
      useFileStore.getState().loadFile('non-existent');
      expect(useFileStore.getState().storageError).toBe('Failed to load file.');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteFile                                                         */
  /* ------------------------------------------------------------------ */

  describe('deleteFile', () => {
    it('removes a non-current file from the index', () => {
      useFileStore.getState().newFile();
      useFileStore.getState().newFile();
      const first = useFileStore.getState().files[0];
      const secondId = useFileStore.getState().currentFileId;

      useFileStore.getState().deleteFile(first.id);
      const state = useFileStore.getState();
      expect(state.files.find((f) => f.id === first.id)).toBeUndefined();
      expect(state.currentFileId).toBe(secondId);
    });

    it('switches to another file when deleting the current file', () => {
      useFileStore.getState().newFile();
      useFileStore.getState().newFile();
      const currentId = useFileStore.getState().currentFileId!;
      const otherId = useFileStore.getState().files.find((f) => f.id !== currentId)!.id;

      useFileStore.getState().deleteFile(currentId);

      const state = useFileStore.getState();
      expect(state.currentFileId).toBe(otherId);
      expect(state.files).toHaveLength(1);
    });

    it('creates a new file when deleting the last remaining file', () => {
      useFileStore.getState().newFile();
      const currentId = useFileStore.getState().currentFileId!;

      useFileStore.getState().deleteFile(currentId);

      const state = useFileStore.getState();
      expect(state.currentFileId).toBeTruthy();
      expect(state.files).toHaveLength(1);
      expect(state.currentFileId).not.toBe(currentId);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  renameFile                                                         */
  /* ------------------------------------------------------------------ */

  describe('renameFile', () => {
    it('renames a file in the index', () => {
      useFileStore.getState().newFile();
      const id = useFileStore.getState().currentFileId!;

      useFileStore.getState().renameFile(id, 'New Name');
      const entry = useFileStore.getState().files.find((f) => f.id === id);
      expect(entry!.title).toBe('New Name');
    });

    it('updates diagram metadata when renaming the current file', () => {
      useFileStore.getState().newFile();
      const id = useFileStore.getState().currentFileId!;

      useFileStore.getState().renameFile(id, 'Updated Title');
      expect(diagramSetState).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({ title: 'Updated Title' }),
        }),
      );
    });

    it('sets storageError on failure', () => {
      useFileStore.getState().newFile();
      const id = useFileStore.getState().currentFileId!;

      mock.renameFile.mockReturnValueOnce(false);
      useFileStore.getState().renameFile(id, 'Fail');

      expect(useFileStore.getState().storageError).toBe('Failed to rename file.');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  loadInitialFile                                                    */
  /* ------------------------------------------------------------------ */

  describe('loadInitialFile', () => {
    it('loads the last-opened file when one exists', () => {
      useFileStore.getState().newFile();
      const firstId = useFileStore.getState().currentFileId!;

      // Reset store (simulating page refresh)
      useFileStore.setState({ currentFileId: null, files: [] });
      diagramSetState.mockClear();

      useFileStore.getState().loadInitialFile();

      expect(useFileStore.getState().currentFileId).toBe(firstId);
      expect(diagramSetState).toHaveBeenCalled();
    });

    it('creates a new file on first visit (no current file)', () => {
      mock.currentId.set(null);
      useFileStore.getState().loadInitialFile();

      const state = useFileStore.getState();
      expect(state.currentFileId).toBeTruthy();
      expect(state.files).toHaveLength(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clearStorageError                                                  */
  /* ------------------------------------------------------------------ */

  describe('clearStorageError', () => {
    it('clears the storage error', () => {
      useFileStore.setState({ storageError: 'Error occurred' });
      useFileStore.getState().clearStorageError();
      expect(useFileStore.getState().storageError).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  setCurrentFile                                                     */
  /* ------------------------------------------------------------------ */

  describe('setCurrentFile', () => {
    it('sets the current file ID', () => {
      useFileStore.getState().setCurrentFile('file-1');
      expect(useFileStore.getState().currentFileId).toBe('file-1');
    });

    it('persists the current file ID to storage', () => {
      useFileStore.getState().setCurrentFile('file-1');
      expect(mock.setCurrentFileId).toHaveBeenCalledWith('file-1');
    });
  });
});

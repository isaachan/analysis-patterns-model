/**
 * Zustand store for multi-file management.
 *
 * Coordinates between the storage layer and the diagram store:
 *   - Maintains the file index in memory (synced with localStorage)
 *   - Handles file creation, loading, deletion, and renaming
 *   - Provides save/load orchestration (saves current file before switching)
 *   - Reports storage errors for display in the StatusBar
 */

import { create } from 'zustand';
import * as storage from '../utils/storage';
import type { FileEntry } from '../utils/storage';
import type { DiagramState } from '../models/diagram';
import { useDiagramStore } from './useDiagramStore';
import { useHistoryStore } from './useHistoryStore';

/* ------------------------------------------------------------------ */
/*  Store Interface                                                    */
/* ------------------------------------------------------------------ */

export interface FileStore {
  /** ID of the currently open file, or null when no file is loaded */
  currentFileId: string | null;

  /** In-memory copy of the file index, sorted by updatedAt descending */
  files: FileEntry[];

  /** Non-null when the last storage operation failed */
  storageError: string | null;

  /* ---- Actions ---- */

  /** Switch the current file pointer without loading data into the diagram store */
  setCurrentFile: (id: string) => void;

  /**
   * Load a file from storage into the diagram store.
   * Saves the current file first before loading the new one.
   */
  loadFile: (id: string) => void;

  /** Create a new empty file and load it into the diagram store */
  newFile: () => void;

  /** Delete a file from storage. Handles current-file switching when needed */
  deleteFile: (id: string) => void;

  /** Rename a file in the index (also updates diagram metadata) */
  renameFile: (id: string, title: string) => void;

  /** Save the current diagram store state back to localStorage */
  saveCurrentFile: () => void;

  /**
   * Bootstrap on app startup.
   * Loads the last-opened file, or creates a new file on first visit.
   */
  loadInitialFile: () => void;

  /** Clear the stored error message */
  clearStorageError: () => void;
}

/* ------------------------------------------------------------------ */
/*  Helper: update a file's timestamp in the index                     */
/* ------------------------------------------------------------------ */

function updateTimestamp(
  files: FileEntry[],
  fileId: string,
  now: number,
): FileEntry[] {
  return files.map((f) =>
    f.id === fileId ? { ...f, updatedAt: now } : f,
  );
}

/* ------------------------------------------------------------------ */
/*  Helper: sort files by updatedAt descending                         */
/* ------------------------------------------------------------------ */

function sortFiles(files: FileEntry[]): FileEntry[] {
  return [...files].sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useFileStore = create<FileStore>((set, get) => ({
  currentFileId: null,
  files: [],
  storageError: null,

  /* ---- Actions ---- */

  setCurrentFile: (id) => {
    set({ currentFileId: id });
    storage.setCurrentFileId(id);
  },

  loadFile: (id) => {
    const { currentFileId } = get();

    // Save the current file before switching
    if (currentFileId && currentFileId !== id) {
      get().saveCurrentFile();
    }

    const state = storage.getFile(id);
    if (!state) {
      set({ storageError: 'Failed to load file.' });
      return;
    }

    // Restore full diagram state without pushing to history
    useDiagramStore.setState({
      version: state.version,
      metadata: state.metadata,
      elements: state.elements,
    });

    // Clear undo/redo history (it is per-file)
    useHistoryStore.getState().clear();

    set({ currentFileId: id, storageError: null });
    storage.setCurrentFileId(id);
  },

  newFile: () => {
    const { currentFileId } = get();

    // Save the current file before switching
    if (currentFileId) {
      get().saveCurrentFile();
    }

    const { id, state } = storage.createNewFile();

    // Reload index from storage (createNewFile already updated it)
    const index = sortFiles(storage.getFileIndex());

    // Load the empty state into the diagram store
    useDiagramStore.setState({
      version: state.version,
      metadata: state.metadata,
      elements: state.elements,
    });

    useHistoryStore.getState().clear();
    set({ currentFileId: id, files: index, storageError: null });
  },

  deleteFile: (id) => {
    const { currentFileId } = get();

    storage.deleteFile(id);
    const newIndex = sortFiles(storage.getFileIndex());

    if (currentFileId === id) {
      // Deleted the currently open file — switch to the most recent or create one
      const others = newIndex.filter((f) => f.id !== id);
      if (others.length > 0) {
        get().loadFile(others[0].id);
      } else {
        // No files left; clear the current file so newFile() does not try to
        // save the deleted file before creating a fresh one.
        set({ currentFileId: null });
        get().newFile();
        return; // newFile already updates the store
      }
    }

    set({ files: newIndex });
  },

  renameFile: (id, title) => {
    const success = storage.renameFile(id, title);
    if (!success) {
      set({ storageError: 'Failed to rename file.' });
      return;
    }

    // Reload index
    const index = sortFiles(storage.getFileIndex());
    set({ files: index, storageError: null });

    // Also update diagram metadata if renaming the current file
    if (get().currentFileId === id) {
      const diagram = useDiagramStore.getState();
      useDiagramStore.setState({
        metadata: { ...diagram.metadata, title },
      });
    }
  },

  saveCurrentFile: () => {
    const { currentFileId } = get();
    if (!currentFileId) return;

    const diagram = useDiagramStore.getState();
    const now = Date.now();

    const stateToSave: DiagramState = {
      version: diagram.version,
      metadata: {
        ...diagram.metadata,
        updatedAt: now,
      },
      elements: diagram.elements,
    };

    const success = storage.saveFile(currentFileId, stateToSave);
    if (!success) {
      set({ storageError: 'Storage quota exceeded. Unable to save.' });
      return;
    }

    // Update timestamp in the index
    const updated = updateTimestamp(get().files, currentFileId, now);
    storage.saveFileIndex(updated);
    set({ files: updated, storageError: null });
  },

  loadInitialFile: () => {
    const currentId = storage.getCurrentFileId();
    const index = sortFiles(storage.getFileIndex());

    if (currentId) {
      const state = storage.getFile(currentId);
      if (state) {
        // Found the last-opened file — load it
        useDiagramStore.setState({
          version: state.version,
          metadata: state.metadata,
          elements: state.elements,
        });
        useHistoryStore.getState().clear();
        set({ currentFileId: currentId, files: index });
        return;
      }
    }

    // First visit or last-opened file gone — create a new file
    get().newFile();
  },

  clearStorageError: () => set({ storageError: null }),
}));

export default useFileStore;

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { DiagramState } from '../models/diagram';

/* ------------------------------------------------------------------ */
/*  Import storage functions (module is not mocked — use real impl)    */
/* ------------------------------------------------------------------ */

const storage = await import('../utils/storage');

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Create a minimal DiagramState for testing. */
function makeState(overrides?: Partial<DiagramState>): DiagramState {
  return {
    version: '1.0.0',
    metadata: {
      title: overrides?.metadata?.title ?? 'Test Diagram',
      createdAt: overrides?.metadata?.createdAt ?? 1000,
      updatedAt: overrides?.metadata?.updatedAt ?? 1000,
    },
    elements: overrides?.elements ?? [],
  };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('storage — multi-file operations', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  /* ------------------------------------------------------------------ */
  /*  File index                                                        */
  /* ------------------------------------------------------------------ */

  describe('getFileIndex / saveFileIndex', () => {
    it('returns empty array when no index exists', () => {
      expect(storage.getFileIndex()).toEqual([]);
    });

    it('saves and retrieves the file index', () => {
      const entries = [
        { id: 'a', title: 'File A', createdAt: 1, updatedAt: 2 },
        { id: 'b', title: 'File B', createdAt: 3, updatedAt: 4 },
      ];
      storage.saveFileIndex(entries);
      expect(storage.getFileIndex()).toEqual(entries);
    });

    it('overwrites the index on subsequent saves', () => {
      storage.saveFileIndex([{ id: '1', title: 'First', createdAt: 1, updatedAt: 1 }]);
      storage.saveFileIndex([{ id: '2', title: 'Second', createdAt: 2, updatedAt: 2 }]);
      const index = storage.getFileIndex();
      expect(index).toHaveLength(1);
      expect(index[0].id).toBe('2');
    });

    it('returns empty array on corrupted JSON', () => {
      localStorage.setItem('ame-file-index', 'not-json');
      expect(storage.getFileIndex()).toEqual([]);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  File data (getFile / saveFile)                                     */
  /* ------------------------------------------------------------------ */

  describe('getFile / saveFile', () => {
    it('returns null for non-existent file', () => {
      expect(storage.getFile('nonexistent')).toBeNull();
    });

    it('saves and retrieves a file', () => {
      const state = makeState({ metadata: { title: 'My Diagram', createdAt: 1, updatedAt: 2 } });
      const ok = storage.saveFile('test-id', state);
      expect(ok).toBe(true);

      const loaded = storage.getFile('test-id');
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.title).toBe('My Diagram');
      expect(loaded!.elements).toEqual([]);
    });

    it('returns null for corrupted file data', () => {
      localStorage.setItem('ame-file-test-id', '{{{bad json}}');
      expect(storage.getFile('test-id')).toBeNull();
    });

    it('stores files under separate keys', () => {
      storage.saveFile('id-a', makeState({ metadata: { title: 'A', createdAt: 1, updatedAt: 1 } }));
      storage.saveFile('id-b', makeState({ metadata: { title: 'B', createdAt: 2, updatedAt: 2 } }));

      expect(storage.getFile('id-a')!.metadata.title).toBe('A');
      expect(storage.getFile('id-b')!.metadata.title).toBe('B');
    });

    it('returns false when localStorage.setItem throws', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      const result = storage.saveFile('id', makeState());
      expect(result).toBe(false);
      setItem.mockRestore();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  Current file tracking                                              */
  /* ------------------------------------------------------------------ */

  describe('getCurrentFileId / setCurrentFileId', () => {
    it('returns null when no current file is set', () => {
      expect(storage.getCurrentFileId()).toBeNull();
    });

    it('sets and retrieves the current file ID', () => {
      storage.setCurrentFileId('file-1');
      expect(storage.getCurrentFileId()).toBe('file-1');
    });

    it('overwrites the current file ID', () => {
      storage.setCurrentFileId('file-1');
      storage.setCurrentFileId('file-2');
      expect(storage.getCurrentFileId()).toBe('file-2');
    });

    it('removes the key when set to null', () => {
      storage.setCurrentFileId('file-1');
      storage.setCurrentFileId(null);
      expect(storage.getCurrentFileId()).toBeNull();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  createNewFile                                                      */
  /* ------------------------------------------------------------------ */

  describe('createNewFile', () => {
    it('creates a file with the default title "Untitled"', () => {
      const { id, state } = storage.createNewFile();
      expect(id).toBeTruthy();
      expect(state.metadata.title).toBe('Untitled');
      expect(state.elements).toEqual([]);
    });

    it('creates a file with a custom title', () => {
      const { state } = storage.createNewFile('My Diagram');
      expect(state.metadata.title).toBe('My Diagram');
    });

    it('auto-generates unique titles (Untitled-1, Untitled-2, ...)', () => {
      // First file gets "Untitled"
      storage.createNewFile();
      // Second file should get "Untitled-1"
      const { state: second } = storage.createNewFile();
      expect(second.metadata.title).toBe('Untitled-1');
      // Third file gets "Untitled-2"
      const { state: third } = storage.createNewFile();
      expect(third.metadata.title).toBe('Untitled-2');
    });

    it('creates files that are retrievable via getFile', () => {
      const { id } = storage.createNewFile('Persisted');
      const loaded = storage.getFile(id);
      expect(loaded).not.toBeNull();
      expect(loaded!.metadata.title).toBe('Persisted');
    });

    it('updates the file index entry', () => {
      storage.createNewFile('Indexed');
      const index = storage.getFileIndex();
      expect(index).toHaveLength(1);
      expect(index[0].title).toBe('Indexed');
    });

    it('sets the created file as the current file', () => {
      const { id } = storage.createNewFile('Current');
      expect(storage.getCurrentFileId()).toBe(id);
    });

    it('creates a file with unique titles when custom title already exists', () => {
      storage.createNewFile('Project');
      const { state } = storage.createNewFile('Project');
      expect(state.metadata.title).toBe('Project-1');
    });
  });

  /* ------------------------------------------------------------------ */
  /*  deleteFile                                                         */
  /* ------------------------------------------------------------------ */

  describe('deleteFile', () => {
    it('removes a file from the index', () => {
      const { id } = storage.createNewFile('ToDelete');
      storage.deleteFile(id);
      const index = storage.getFileIndex();
      expect(index.find((f) => f.id === id)).toBeUndefined();
    });

    it('removes the file data from localStorage', () => {
      const { id } = storage.createNewFile('ToDelete');
      storage.deleteFile(id);
      expect(storage.getFile(id)).toBeNull();
    });

    it('clears the current file pointer when deleting the current file', () => {
      const { id } = storage.createNewFile('Current');
      expect(storage.getCurrentFileId()).toBe(id);
      storage.deleteFile(id);
      expect(storage.getCurrentFileId()).toBeNull();
    });

    it('does not affect other files', () => {
      const { id: id1 } = storage.createNewFile('A');
      const { id: id2 } = storage.createNewFile('B');
      storage.deleteFile(id1);
      expect(storage.getFile(id2)).not.toBeNull();
      expect(storage.getFileIndex()).toHaveLength(1);
    });

    it('does nothing when deleting a non-existent file', () => {
      storage.createNewFile('Only');
      storage.deleteFile('non-existent');
      expect(storage.getFileIndex()).toHaveLength(1);
    });
  });

  /* ------------------------------------------------------------------ */
  /*  renameFile                                                         */
  /* ------------------------------------------------------------------ */

  describe('renameFile', () => {
    it('renames a file in the index', () => {
      const { id } = storage.createNewFile('OldName');
      const ok = storage.renameFile(id, 'NewName');
      expect(ok).toBe(true);

      const index = storage.getFileIndex();
      const entry = index.find((f) => f.id === id);
      expect(entry!.title).toBe('NewName');
    });

    it('returns false when the file does not exist', () => {
      const ok = storage.renameFile('nonexistent', 'Nope');
      expect(ok).toBe(false);
    });

    it('allows duplicate titles', () => {
      storage.createNewFile('Shared');
      const { id: id2 } = storage.createNewFile('Other');
      storage.renameFile(id2, 'Shared');
      const index = storage.getFileIndex();
      const titles = index.filter((f) => f.title === 'Shared');
      expect(titles).toHaveLength(2);
    });

    it('updates the updatedAt timestamp', () => {
      vi.useFakeTimers();
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      const { id } = storage.createNewFile('Old');
      const before = storage.getFileIndex().find((f) => f.id === id)!.updatedAt;
      vi.advanceTimersByTime(1000);
      storage.renameFile(id, 'New');
      const after = storage.getFileIndex().find((f) => f.id === id)!.updatedAt;
      expect(after).toBeGreaterThan(before);
      expect(after - before).toBe(1000);
      vi.useRealTimers();
    });
  });

  /* ------------------------------------------------------------------ */
  /*  clearAllFiles                                                      */
  /* ------------------------------------------------------------------ */

  describe('clearAllFiles', () => {
    it('removes all files and index', () => {
      storage.createNewFile('A');
      storage.createNewFile('B');
      storage.createNewFile('C');
      storage.clearAllFiles();
      expect(storage.getFileIndex()).toEqual([]);
      expect(storage.getCurrentFileId()).toBeNull();
    });

    it('removes file data from localStorage', () => {
      const { id } = storage.createNewFile('Solo');
      storage.clearAllFiles();
      expect(storage.getFile(id)).toBeNull();
    });
  });
});

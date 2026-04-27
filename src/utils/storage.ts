const STORAGE_KEY_PREFIX = 'ame-model-editor-';

export const STORAGE_KEYS = {
  FILES_INDEX: `${STORAGE_KEY_PREFIX}files`,
  CURRENT_FILE_ID: `${STORAGE_KEY_PREFIX}current-id`,
  FILE_DATA: (id: string) => `${STORAGE_KEY_PREFIX}file-${id}`,
};

export interface FileInfo {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Serialize and save data to localStorage.
 * Returns success/failure status so callers can handle quota errors gracefully.
 */
export function saveToLocalStorage<T>(key: string, data: T): { success: boolean; error?: string } {
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
    return { success: true };
  } catch (e) {
    const message =
      e instanceof DOMException &&
      (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
        ? '存储空间不足，无法保存'
        : '保存失败';
    return { success: false, error: message };
  }
}

/**
 * Load and parse data from localStorage.
 * Returns null when the key does not exist or on parse error.
 */
export function loadFromLocalStorage<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Estimate the byte size of data when stored as JSON.
 */
export function estimateSize(data: unknown): number {
  try {
    const json = JSON.stringify(data);
    return new Blob([json]).size;
  } catch {
    return 0;
  }
}

// ---- Backward-compatible helpers -------------------------------------------

export function getFileIndex(): FileInfo[] {
  return loadFromLocalStorage<FileInfo[]>(STORAGE_KEYS.FILES_INDEX) || [];
}

export function saveFileIndex(index: FileInfo[]): void {
  saveToLocalStorage(STORAGE_KEYS.FILES_INDEX, index);
}

export function saveDiagram(id: string, data: unknown): { success: boolean; error?: string } {
  return saveToLocalStorage(STORAGE_KEYS.FILE_DATA(id), data);
}

export function loadDiagram(id: string): unknown | null {
  return loadFromLocalStorage(STORAGE_KEYS.FILE_DATA(id));
}

export function deleteDiagram(id: string): void {
  localStorage.removeItem(STORAGE_KEYS.FILE_DATA(id));
}
